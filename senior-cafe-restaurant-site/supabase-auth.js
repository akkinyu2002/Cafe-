(function initializeKanigiriSupabaseAuth() {
  const SESSION_KEY = "kanigiri_supabase_session_v1";
  const CHANNEL_NAME = "kanigiri_supabase_auth_channel";
  const EXPIRY_SAFETY_SECONDS = 20;

  const config = window.KanigiriSupabaseConfig || {};
  const supabaseUrl = String(config.url || "")
    .trim()
    .replace(/\/+$/, "");
  const supabaseAnonKey = String(config.anonKey || "").trim();
  const configured = Boolean(supabaseUrl && supabaseAnonKey);

  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const listeners = new Set();

  let session = null;
  let currentUser = null;
  let refreshPromise = null;

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
      // Ignore cross-tab messaging failures.
    }
  }

  function normalizeSession(rawSession) {
    if (!rawSession || typeof rawSession !== "object") {
      return null;
    }

    const accessToken = String(rawSession.access_token || "").trim();
    const refreshToken = String(rawSession.refresh_token || "").trim();
    if (!accessToken || !refreshToken) {
      return null;
    }

    const expiresAtRaw = Number(rawSession.expires_at);
    const expiresInRaw = Number(rawSession.expires_in);
    const expiresAt = Number.isFinite(expiresAtRaw)
      ? Math.floor(expiresAtRaw)
      : Number.isFinite(expiresInRaw)
        ? Math.floor(Date.now() / 1000) + Math.max(Math.floor(expiresInRaw), 0)
        : 0;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: String(rawSession.token_type || "bearer"),
      expires_at: expiresAt,
      expires_in: Math.max(expiresAt - Math.floor(Date.now() / 1000), 0),
      user: rawSession.user && typeof rawSession.user === "object" ? cloneData(rawSession.user) : null
    };
  }

  function readStoredSession() {
    const rawValue = window.localStorage.getItem(SESSION_KEY);
    if (!rawValue) {
      return null;
    }

    try {
      return normalizeSession(JSON.parse(rawValue));
    } catch {
      return null;
    }
  }

  function persistSession(nextSession) {
    if (!nextSession) {
      window.localStorage.removeItem(SESSION_KEY);
      return;
    }

    window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  }

  function getUserEmail() {
    const emailValue = currentUser?.email;
    return typeof emailValue === "string" ? emailValue : "";
  }

  function getUserId() {
    const idValue = currentUser?.id;
    return typeof idValue === "string" ? idValue : "";
  }

  function getAccessToken() {
    return session?.access_token || "";
  }

  function getSession() {
    return cloneData(session);
  }

  function getUser() {
    return cloneData(currentUser);
  }

  function isAuthenticated() {
    return Boolean(session?.access_token && currentUser?.id);
  }

  function isConfigured() {
    return configured;
  }

  function willExpireSoon(nextSession) {
    if (!nextSession || !Number.isFinite(Number(nextSession.expires_at))) {
      return true;
    }

    const expiresAtSeconds = Number(nextSession.expires_at);
    const nowSeconds = Math.floor(Date.now() / 1000);
    return expiresAtSeconds - nowSeconds <= EXPIRY_SAFETY_SECONDS;
  }

  async function requestAuth(path, method, body, accessToken) {
    if (!configured) {
      throw new Error("Supabase auth is not configured.");
    }

    const headers = {
      apikey: supabaseAnonKey,
      Accept: "application/json"
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const requestInit = {
      method,
      headers
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(`${supabaseUrl}${path}`, requestInit);
    const responseType = response.headers.get("content-type") || "";
    const jsonBody =
      responseType.includes("application/json") && response.status !== 204
        ? await response.json().catch(() => null)
        : null;

    if (!response.ok) {
      const message =
        jsonBody?.msg || jsonBody?.error_description || jsonBody?.error || `Authentication request failed (${response.status}).`;
      throw new Error(message);
    }

    return jsonBody;
  }

  async function fetchCurrentUser(accessToken) {
    const user = await requestAuth("/auth/v1/user", "GET", undefined, accessToken);
    return user && typeof user === "object" ? user : null;
  }

  function updateSession(nextSession, options) {
    const resolvedOptions = options || {};
    const normalized = normalizeSession(nextSession);

    session = normalized;
    currentUser = normalized?.user && typeof normalized.user === "object" ? cloneData(normalized.user) : null;
    persistSession(session);

    if (resolvedOptions.broadcast !== false) {
      notifyAcrossContexts("auth:changed", {
        session: getSession(),
        user: getUser()
      });
    }

    if (resolvedOptions.emit !== false) {
      emit("auth:changed", {
        session: getSession(),
        user: getUser()
      });
    }
  }

  async function refreshSession() {
    if (!configured || !session?.refresh_token) {
      return null;
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      const refreshPayload = await requestAuth("/auth/v1/token?grant_type=refresh_token", "POST", {
        refresh_token: session.refresh_token
      });

      const refreshedSession = normalizeSession(refreshPayload);
      if (!refreshedSession) {
        throw new Error("Failed to refresh authentication session.");
      }

      const refreshedUser = refreshPayload?.user || (await fetchCurrentUser(refreshedSession.access_token));
      refreshedSession.user = refreshedUser;
      updateSession(refreshedSession);

      return getSession();
    })()
      .catch((error) => {
        updateSession(null);
        emit("auth:error", { message: error?.message || "Failed to refresh session." });
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  async function ensureSession() {
    if (!configured || !session) {
      return null;
    }

    if (willExpireSoon(session)) {
      return refreshSession();
    }

    if (!currentUser?.id) {
      try {
        const user = await fetchCurrentUser(session.access_token);
        if (user) {
          session.user = user;
          currentUser = cloneData(user);
          persistSession(session);
          emit("auth:changed", { session: getSession(), user: getUser() });
        }
      } catch {
        await refreshSession();
      }
    }

    return getSession();
  }

  async function signIn(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPassword = String(password || "");

    if (!normalizedEmail || !normalizedPassword) {
      return { ok: false, error: "Email and password are required." };
    }

    if (!configured) {
      return { ok: false, error: "Supabase auth is not configured." };
    }

    try {
      const payload = await requestAuth("/auth/v1/token?grant_type=password", "POST", {
        email: normalizedEmail,
        password: normalizedPassword
      });

      const nextSession = normalizeSession(payload);
      if (!nextSession) {
        return { ok: false, error: "Unable to sign in with this account." };
      }

      const user = payload?.user || (await fetchCurrentUser(nextSession.access_token));
      nextSession.user = user;
      updateSession(nextSession);
      return { ok: true, user: getUser(), session: getSession() };
    } catch (error) {
      const message = error?.message || "Sign in failed.";
      emit("auth:error", { message });
      return { ok: false, error: message };
    }
  }

  async function signUp(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPassword = String(password || "");

    if (!normalizedEmail || !normalizedPassword) {
      return { ok: false, error: "Email and password are required." };
    }

    if (normalizedPassword.length < 6) {
      return { ok: false, error: "Password should be at least 6 characters." };
    }

    if (!configured) {
      return { ok: false, error: "Supabase auth is not configured." };
    }

    try {
      const payload = await requestAuth("/auth/v1/signup", "POST", {
        email: normalizedEmail,
        password: normalizedPassword
      });

      const payloadSession = payload?.session && typeof payload.session === "object" ? payload.session : payload;
      const nextSession = normalizeSession({
        ...payloadSession,
        user: payload?.user || payloadSession?.user || null
      });

      if (nextSession) {
        nextSession.user = payload?.user || nextSession.user || (await fetchCurrentUser(nextSession.access_token));
        updateSession(nextSession);
        return { ok: true, needsEmailConfirmation: false, user: getUser() };
      }

      return { ok: true, needsEmailConfirmation: true, user: payload?.user || null };
    } catch (error) {
      const message = error?.message || "Sign up failed.";
      emit("auth:error", { message });
      return { ok: false, error: message };
    }
  }

  async function signOut() {
    if (!configured) {
      updateSession(null);
      return { ok: true };
    }

    const token = getAccessToken();
    if (token) {
      try {
        await requestAuth("/auth/v1/logout", "POST", {}, token);
      } catch {
        // Ignore logout endpoint failures and clear local session anyway.
      }
    }

    updateSession(null);
    return { ok: true };
  }

  async function isAdmin() {
    if (!configured) {
      return false;
    }

    await ensureSession();
    const token = getAccessToken();
    if (!token) {
      return false;
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: "{}"
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json().catch(() => null);
      return result === true;
    } catch {
      return false;
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

  function handleSessionStorageSync(event) {
    if (event.key !== SESSION_KEY) {
      return;
    }

    const syncedSession = normalizeSession(safeParseSession(event.newValue));
    session = syncedSession;
    currentUser = syncedSession?.user && typeof syncedSession.user === "object" ? cloneData(syncedSession.user) : null;
    emit("auth:changed", {
      session: getSession(),
      user: getUser()
    });
  }

  function safeParseSession(rawValue) {
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue);
    } catch {
      return null;
    }
  }

  if (configured) {
    session = readStoredSession();
    currentUser = session?.user && typeof session.user === "object" ? cloneData(session.user) : null;
  } else {
    session = null;
    currentUser = null;
  }

  window.addEventListener("storage", handleSessionStorageSync);

  if (channel) {
    channel.addEventListener("message", (event) => {
      if (!event?.data || event.data.type !== "auth:changed") {
        return;
      }

      const nextSession = normalizeSession(event.data.payload?.session || null);
      session = nextSession;
      currentUser = nextSession?.user && typeof nextSession.user === "object" ? cloneData(nextSession.user) : null;
      emit("auth:changed", {
        session: getSession(),
        user: getUser()
      });
    });
  }

  if (configured && session) {
    void ensureSession();
  }

  window.KanigiriAuth = {
    isConfigured,
    isAuthenticated,
    getSession,
    getAccessToken,
    getUser,
    getUserId,
    getUserEmail,
    ensureSession,
    refreshSession,
    signIn,
    signUp,
    signOut,
    isAdmin,
    subscribe
  };
})();
