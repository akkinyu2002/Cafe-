(function initializeKanigiriOrdersStore() {
  const ORDERS_KEY = "kanigiri_orders_v1";
  const CHANNEL_NAME = "kanigiri_orders_channel";

  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const listeners = new Set();

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

  function getOrders() {
    return safeParseOrders(window.localStorage.getItem(ORDERS_KEY));
  }

  function emit(eventType, payload) {
    listeners.forEach((listener) => {
      try {
        listener(eventType, payload);
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
      channel.postMessage({ type: eventType, payload });
    } catch {
      // Ignore cross-context messaging errors.
    }
  }

  function saveOrders(orders, metadata) {
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    emit("orders:changed", { orders, metadata: metadata || null });
    notifyAcrossContexts("orders:changed", { metadata: metadata || null });
  }

  function addOrder(order) {
    const orders = getOrders();
    orders.unshift(order);
    saveOrders(orders, { action: "created", orderId: order.id });
    return order;
  }

  function updateOrder(orderId, updater) {
    const orders = getOrders();
    const nextOrders = orders.map((order) => {
      if (order.id !== orderId) {
        return order;
      }

      const updated = updater(order);
      return updated || order;
    });

    saveOrders(nextOrders, { action: "updated", orderId });
    return nextOrders.find((order) => order.id === orderId) || null;
  }

  function replaceOrders(orders, metadata) {
    const safeOrders = Array.isArray(orders) ? orders : [];
    saveOrders(safeOrders, metadata || { action: "replaced" });
  }

  function subscribe(listener) {
    listeners.add(listener);

    function storageListener(event) {
      if (event.key !== ORDERS_KEY) {
        return;
      }

      emit("orders:changed", { orders: getOrders(), metadata: { action: "storage-sync" } });
    }

    function channelListener(event) {
      if (!event?.data || event.data.type !== "orders:changed") {
        return;
      }

      emit("orders:changed", { orders: getOrders(), metadata: { action: "broadcast-sync" } });
    }

    window.addEventListener("storage", storageListener);

    if (channel) {
      channel.addEventListener("message", channelListener);
    }

    return function unsubscribe() {
      listeners.delete(listener);
      window.removeEventListener("storage", storageListener);
      if (channel) {
        channel.removeEventListener("message", channelListener);
      }
    };
  }

  window.KanigiriOrders = {
    ORDERS_KEY,
    getOrders,
    addOrder,
    updateOrder,
    replaceOrders,
    subscribe
  };
})();
