(function initializeKanigiriOrdersStore() {
  const ORDERS_KEY = "kanigiri_orders_v1";
  const CHANNEL_NAME = "kanigiri_orders_channel";
  const REMOTE_SYNC_INTERVAL_MS = 5000;

  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const listeners = new Set();

  const supabaseConfig = window.KanigiriSupabaseConfig || {};
  const authStore = window.KanigiriAuth || null;
  const supabaseUrl = String(supabaseConfig.url || "")
    .trim()
    .replace(/\/+$/, "");
  const supabaseAnonKey = String(supabaseConfig.anonKey || "").trim();
  const supabaseSchema = String(supabaseConfig.schema || "public").trim() || "public";
  const supabaseOrdersTable = String(supabaseConfig.ordersTable || "orders").trim() || "orders";
  const remoteEnabled = Boolean(supabaseUrl && supabaseAnonKey);
  const remoteAuthRequired = supabaseConfig.requireAuthForOrders !== false;

  let currentOrders = [];
  let remoteSyncTimer = null;
  let remoteSyncInFlight = null;
  let remoteWriteChain = Promise.resolve();
  let remoteSyncStarted = false;

  function safeParseOrders(rawValue) {
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function cloneData(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function isValidDateValue(value) {
    return !Number.isNaN(new Date(value).getTime());
  }

  function normalizeOrder(rawOrder) {
    if (!rawOrder || typeof rawOrder !== "object") {
      return null;
    }

    const rawId = rawOrder.id;
    const id = typeof rawId === "string" || typeof rawId === "number" ? String(rawId).trim() : "";
    if (!id) {
      return null;
    }

    const rawUserId = rawOrder.userId || rawOrder.user_id;
    const userId = typeof rawUserId === "string" || typeof rawUserId === "number" ? String(rawUserId).trim() : "";

    const now = new Date().toISOString();
    const createdAtRaw = rawOrder.createdAt || rawOrder.created_at;
    const updatedAtRaw = rawOrder.updatedAt || rawOrder.updated_at || createdAtRaw;
    const createdAt = isValidDateValue(createdAtRaw) ? new Date(createdAtRaw).toISOString() : now;
    const updatedAt = isValidDateValue(updatedAtRaw) ? new Date(updatedAtRaw).toISOString() : createdAt;

    return {
      ...cloneData(rawOrder),
      id,
      userId,
      createdAt,
      updatedAt,
      status: typeof rawOrder.status === "string" && rawOrder.status.trim() ? rawOrder.status.trim() : "Placed",
      customer: rawOrder.customer && typeof rawOrder.customer === "object" ? cloneData(rawOrder.customer) : {},
      items: Array.isArray(rawOrder.items) ? cloneData(rawOrder.items) : [],
      totals: rawOrder.totals && typeof rawOrder.totals === "object" ? cloneData(rawOrder.totals) : {},
      audit: Array.isArray(rawOrder.audit) ? cloneData(rawOrder.audit) : []
    };
  }

  function normalizeOrders(rawOrders) {
    if (!Array.isArray(rawOrders)) {
      return [];
    }

    const deduped = new Map();
    rawOrders.forEach((rawOrder) => {
      const order = normalizeOrder(rawOrder);
      if (!order) {
        return;
      }

      const existing = deduped.get(order.id);
      if (!existing) {
        deduped.set(order.id, order);
        return;
      }

      const existingUpdated = new Date(existing.updatedAt).getTime();
      const nextUpdated = new Date(order.updatedAt).getTime();
      if (nextUpdated >= existingUpdated) {
        deduped.set(order.id, order);
      }
    });

    return Array.from(deduped.values()).sort((a, b) => {
      const createdDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  function buildOrdersSignature(orders) {
    return orders
      .map((order) => `${order.id}|${order.updatedAt}|${order.status || ""}|${order.userId || ""}`)
      .join("||");
  }

  function getOrders() {
    return cloneData(currentOrders);
  }

  function getAuthAccessToken() {
    return typeof authStore?.getAccessToken === "function" ? String(authStore.getAccessToken() || "") : "";
  }

  function getAuthUserId() {
    return typeof authStore?.getUserId === "function" ? String(authStore.getUserId() || "") : "";
  }

  function hasAuthenticatedUser() {
    return Boolean(authStore && typeof authStore.isAuthenticated === "function" && authStore.isAuthenticated());
  }

  function canUseRemote() {
    if (!remoteEnabled) {
      return false;
    }

    if (!remoteAuthRequired) {
      return true;
    }

    return hasAuthenticatedUser();
  }

  function emit(eventType, payload) {
    listeners.forEach((listener) => {
      try {
        listener(eventType, payload || null);
      } catch {
        // Keep listener failures isolated.
      }
    });
  }

  function notifyAcrossContexts(eventType, payload) {
    if (!channel) {
      return;
    }

    try {
      channel.postMessage({ type: eventType, payload: payload || null });
    } catch {
      // Ignore cross-context messaging errors.
    }
  }

  function saveOrdersLocally(orders, metadata, options) {
    const normalizedOrders = normalizeOrders(orders);
    const resolvedOptions = options || {};

    currentOrders = normalizedOrders;
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(currentOrders));

    if (resolvedOptions.emit !== false) {
      emit("orders:changed", { orders: getOrders(), metadata: metadata || null });
    }

    if (resolvedOptions.broadcast !== false) {
      notifyAcrossContexts("orders:changed", { metadata: metadata || null });
    }

    return getOrders();
  }

  function createRemoteHeaders(extraHeaders) {
    const accessToken = getAuthAccessToken();
    const headers = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
      Accept: "application/json",
      "Accept-Profile": supabaseSchema
    };

    if (extraHeaders && typeof extraHeaders === "object") {
      Object.assign(headers, extraHeaders);
    }

    return headers;
  }

  function createRemoteUrl(params) {
    const url = new URL(`/rest/v1/${encodeURIComponent(supabaseOrdersTable)}`, `${supabaseUrl}/`);

    if (params && typeof params === "object") {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  async function requestRemote(method, params, body, extraHeaders) {
    const headers = createRemoteHeaders(extraHeaders);
    const requestInit = {
      method,
      headers
    };

    if (body !== undefined) {
      requestInit.body = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
      headers["Content-Profile"] = supabaseSchema;
    }

    const response = await fetch(createRemoteUrl(params), requestInit);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `Supabase request failed (${response.status}).`);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }

    return response.json();
  }

  function toRemoteRecord(order) {
    return {
      id: order.id,
      user_id: order.userId || getAuthUserId() || null,
      order_data: order,
      created_at: order.createdAt,
      updated_at: order.updatedAt
    };
  }

  function fromRemoteRecord(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const orderData = record.order_data && typeof record.order_data === "object" ? record.order_data : {};
    return normalizeOrder({
      ...orderData,
      id: orderData.id || record.id,
      userId: orderData.userId || record.user_id,
      createdAt: orderData.createdAt || record.created_at,
      updatedAt: orderData.updatedAt || record.updated_at
    });
  }

  async function fetchRemoteOrders() {
    const records = await requestRemote("GET", {
      select: "id,user_id,order_data,created_at,updated_at",
      order: "created_at.desc"
    });

    const mappedOrders = Array.isArray(records) ? records.map((record) => fromRemoteRecord(record)).filter(Boolean) : [];
    return normalizeOrders(mappedOrders);
  }

  async function upsertRemoteOrders(orders) {
    const normalizedOrders = normalizeOrders(orders);
    if (normalizedOrders.length === 0) {
      return;
    }

    await requestRemote(
      "POST",
      { on_conflict: "id" },
      normalizedOrders.map((order) => toRemoteRecord(order)),
      { Prefer: "resolution=merge-duplicates,return=minimal" }
    );
  }

  function quoteFilterValue(value) {
    return `"${String(value).replaceAll('"', '\\"')}"`;
  }

  async function deleteRemoteOrdersByIds(orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return;
    }

    const filterValue = `in.(${orderIds.map((orderId) => quoteFilterValue(orderId)).join(",")})`;
    await requestRemote("DELETE", { id: filterValue }, undefined, { Prefer: "return=minimal" });
  }

  async function clearRemoteOrders() {
    await requestRemote("DELETE", { id: "not.is.null" }, undefined, { Prefer: "return=minimal" });
  }

  async function replaceRemoteOrders(orders) {
    const normalizedOrders = normalizeOrders(orders);
    if (normalizedOrders.length === 0) {
      await clearRemoteOrders();
      return;
    }

    await upsertRemoteOrders(normalizedOrders);

    const remoteIdRows = await requestRemote("GET", { select: "id" });
    const remoteIds = Array.isArray(remoteIdRows) ? remoteIdRows.map((row) => String(row.id || "")).filter(Boolean) : [];
    const keepIds = new Set(normalizedOrders.map((order) => order.id));
    const staleIds = remoteIds.filter((orderId) => !keepIds.has(orderId));

    if (staleIds.length > 0) {
      await deleteRemoteOrdersByIds(staleIds);
    }
  }

  function queueRemoteWrite(task, metadata) {
    if (!remoteEnabled) {
      return;
    }

    if (!canUseRemote()) {
      if (remoteAuthRequired) {
        emit("orders:error", {
          message: "Sign in is required before syncing orders online.",
          metadata: metadata || null
        });
      }
      return;
    }

    remoteWriteChain = remoteWriteChain
      .catch(() => null)
      .then(() => task())
      .then(() => refreshOrders({ ...(metadata || {}), source: "supabase" }))
      .catch((error) => {
        emit("orders:error", {
          message: error?.message || "Cloud sync failed.",
          metadata: metadata || null
        });
      });
  }

  async function refreshOrders(metadata) {
    if (!canUseRemote()) {
      return getOrders();
    }

    if (remoteSyncInFlight) {
      return remoteSyncInFlight;
    }

    remoteSyncInFlight = (async () => {
      const remoteOrders = await fetchRemoteOrders();

      if (remoteOrders.length === 0 && currentOrders.length > 0) {
        await upsertRemoteOrders(currentOrders);
        const uploadedOrders = await fetchRemoteOrders();

        if (buildOrdersSignature(uploadedOrders) !== buildOrdersSignature(currentOrders)) {
          saveOrdersLocally(
            uploadedOrders,
            { action: "remote-bootstrap-uploaded", source: "supabase" },
            { emit: true, broadcast: true }
          );
        }

        return getOrders();
      }

      if (buildOrdersSignature(remoteOrders) !== buildOrdersSignature(currentOrders)) {
        saveOrdersLocally(remoteOrders, metadata || { action: "remote-sync", source: "supabase" }, {
          emit: true,
          broadcast: true
        });
      }

      return getOrders();
    })()
      .catch((error) => {
        emit("orders:error", {
          message: error?.message || "Unable to sync orders from Supabase.",
          metadata: metadata || null
        });
        return getOrders();
      })
      .finally(() => {
        remoteSyncInFlight = null;
      });

    return remoteSyncInFlight;
  }

  function handleAuthSessionChange() {
    if (!remoteEnabled) {
      return;
    }

    if (canUseRemote()) {
      void refreshOrders({ action: "auth-session-sync", source: "supabase" });
      return;
    }

    if (remoteAuthRequired) {
      saveOrdersLocally([], { action: "auth-required", source: "auth" }, { emit: true, broadcast: true });
    }
  }

  function startRemoteSync() {
    if (!remoteEnabled || remoteSyncStarted) {
      return;
    }

    remoteSyncStarted = true;

    void refreshOrders({ action: "remote-bootstrap", source: "supabase" });

    remoteSyncTimer = window.setInterval(() => {
      void refreshOrders({ action: "remote-poll", source: "supabase" });
    }, REMOTE_SYNC_INTERVAL_MS);

    window.addEventListener("online", () => {
      void refreshOrders({ action: "remote-online", source: "supabase" });
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        void refreshOrders({ action: "remote-visible", source: "supabase" });
      }
    });

    if (authStore && typeof authStore.subscribe === "function") {
      authStore.subscribe((eventType) => {
        if (eventType === "auth:changed") {
          handleAuthSessionChange();
        }
      });
    }
  }

  function addOrder(order) {
    if (remoteEnabled && remoteAuthRequired && !hasAuthenticatedUser()) {
      emit("orders:error", { message: "Sign in is required before placing an online order." });
      return null;
    }

    const normalizedOrder = normalizeOrder({
      ...(order || {}),
      userId: order?.userId || getAuthUserId() || ""
    });

    if (!normalizedOrder) {
      return null;
    }

    const nextOrders = [normalizedOrder, ...currentOrders.filter((item) => item.id !== normalizedOrder.id)];
    saveOrdersLocally(nextOrders, { action: "created", orderId: normalizedOrder.id, source: "local" });

    queueRemoteWrite(() => upsertRemoteOrders([normalizedOrder]), {
      action: "created",
      orderId: normalizedOrder.id
    });

    return cloneData(normalizedOrder);
  }

  function updateOrder(orderId, updater) {
    if (!orderId || typeof updater !== "function") {
      return null;
    }

    if (remoteEnabled && remoteAuthRequired && !hasAuthenticatedUser()) {
      emit("orders:error", { message: "Sign in is required before updating an order." });
      return null;
    }

    const existingOrder = currentOrders.find((order) => order.id === orderId);
    if (!existingOrder) {
      return null;
    }

    const updaterInput = cloneData(existingOrder);
    const updaterResult = updater(updaterInput);
    const candidateOrder =
      updaterResult && typeof updaterResult === "object"
        ? {
            ...existingOrder,
            ...updaterResult,
            id: existingOrder.id,
            userId: existingOrder.userId,
            createdAt: existingOrder.createdAt
          }
        : existingOrder;

    const normalizedUpdatedOrder = normalizeOrder({
      ...candidateOrder,
      updatedAt:
        candidateOrder.updatedAt && isValidDateValue(candidateOrder.updatedAt)
          ? candidateOrder.updatedAt
          : new Date().toISOString()
    });

    if (!normalizedUpdatedOrder) {
      return null;
    }

    const nextOrders = currentOrders.map((order) => (order.id === orderId ? normalizedUpdatedOrder : order));
    saveOrdersLocally(nextOrders, { action: "updated", orderId, source: "local" });

    queueRemoteWrite(() => upsertRemoteOrders([normalizedUpdatedOrder]), {
      action: "updated",
      orderId
    });

    return cloneData(normalizedUpdatedOrder);
  }

  function replaceOrders(orders, metadata) {
    if (remoteEnabled && remoteAuthRequired && !hasAuthenticatedUser()) {
      emit("orders:error", { message: "Sign in is required before replacing orders." });
      return getOrders();
    }

    const normalizedOrders = normalizeOrders(Array.isArray(orders) ? orders : []);
    const nextMetadata = metadata || { action: "replaced", source: "local" };
    saveOrdersLocally(normalizedOrders, nextMetadata);

    queueRemoteWrite(() => replaceRemoteOrders(normalizedOrders), nextMetadata);

    return getOrders();
  }

  async function clearAllOrders(metadata) {
    const nextMetadata = metadata || { action: "cleared-all", source: "local" };

    if (!remoteEnabled) {
      saveOrdersLocally([], nextMetadata);
      return { ok: true, orders: getOrders(), source: "local" };
    }

    if (remoteAuthRequired && !hasAuthenticatedUser()) {
      const message = "Sign in is required before deleting orders.";
      emit("orders:error", { message, metadata: nextMetadata });
      return { ok: false, error: message, orders: getOrders() };
    }

    try {
      await clearRemoteOrders();
      saveOrdersLocally([], { ...nextMetadata, source: "supabase" });
      return { ok: true, orders: getOrders(), source: "supabase" };
    } catch (error) {
      const message = error?.message || "Unable to delete orders from Supabase.";
      emit("orders:error", { message, metadata: nextMetadata });
      await refreshOrders({ action: "clear-failed-refresh", source: "supabase" }).catch(() => null);
      return { ok: false, error: message, orders: getOrders() };
    }
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return function noop() {};
    }

    listeners.add(listener);

    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  function handleStorageSync(event) {
    if (event.key !== ORDERS_KEY) {
      return;
    }

    const nextOrders = normalizeOrders(safeParseOrders(event.newValue));
    currentOrders = nextOrders;
    emit("orders:changed", { orders: getOrders(), metadata: { action: "storage-sync" } });
  }

  function handleChannelSync(event) {
    if (!event?.data || event.data.type !== "orders:changed") {
      return;
    }

    const storageOrders = normalizeOrders(safeParseOrders(window.localStorage.getItem(ORDERS_KEY)));
    currentOrders = storageOrders;
    emit("orders:changed", { orders: getOrders(), metadata: { action: "broadcast-sync" } });
  }

  currentOrders = normalizeOrders(safeParseOrders(window.localStorage.getItem(ORDERS_KEY)));

  if (remoteEnabled && remoteAuthRequired && !hasAuthenticatedUser()) {
    currentOrders = [];
  }

  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(currentOrders));

  window.addEventListener("storage", handleStorageSync);
  if (channel) {
    channel.addEventListener("message", handleChannelSync);
  }

  startRemoteSync();

  window.KanigiriOrders = {
    ORDERS_KEY,
    remoteEnabled,
    remoteAuthRequired,
    getOrders,
    refreshOrders,
    addOrder,
    updateOrder,
    replaceOrders,
    clearAllOrders,
    subscribe
  };
})();
