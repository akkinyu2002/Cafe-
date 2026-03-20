const orderStore = window.KanigiriOrders || null;

const ORDER_STATUSES = ["Placed", "Preparing", "Ready", "Out for Delivery", "Completed", "Cancelled"];
const ACTIVE_STATUSES = new Set(["Placed", "Preparing", "Ready", "Out for Delivery"]);

const ADMIN_SESSION_KEY = "kanigiri_admin_session_v1";
const ADMIN_USERNAME = "kanigiri_admin";
const ADMIN_PASSWORD = "Kanigiri@2026";

const summaryTotal = document.getElementById("summaryTotal");
const summaryActive = document.getElementById("summaryActive");
const summaryCancelled = document.getElementById("summaryCancelled");
const summaryRevenue = document.getElementById("summaryRevenue");
const orderSearchInput = document.getElementById("orderSearchInput");
const orderStatusFilter = document.getElementById("orderStatusFilter");
const adminOrders = document.getElementById("adminOrders");
const adminNotice = document.getElementById("adminNotice");
const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");
const deleteAllOrdersBtn = document.getElementById("deleteAllOrdersBtn");
const logoutBtn = document.getElementById("logoutBtn");
const lastSyncText = document.getElementById("lastSyncText");

const adminGateForm = document.getElementById("adminGateForm");
const adminUsernameInput = document.getElementById("adminUsername");
const adminPasswordInput = document.getElementById("adminPassword");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const gateError = document.getElementById("gateError");

let allOrders = [];
let adminInitialized = false;

function formatCurrency(value) {
  return `Rs ${Math.round(Number(value) || 0)}`;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusClass(status) {
  return `badge-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function nowStamp() {
  return new Date().toISOString();
}

function setNotice(message, type) {
  if (!adminNotice) {
    return;
  }

  adminNotice.textContent = message;
  adminNotice.classList.remove("success", "error");

  if (type) {
    adminNotice.classList.add(type);
  }
}

function setGateMessage(message) {
  if (!gateError) {
    return;
  }

  gateError.textContent = message;
}

function setAuthState(isAuthenticated) {
  document.body.classList.toggle("admin-authenticated", isAuthenticated);

  if (refreshOrdersBtn instanceof HTMLButtonElement) {
    refreshOrdersBtn.disabled = !isAuthenticated;
  }

  if (deleteAllOrdersBtn instanceof HTMLButtonElement) {
    deleteAllOrdersBtn.disabled = !isAuthenticated;
  }

  if (logoutBtn instanceof HTMLButtonElement) {
    logoutBtn.disabled = !isAuthenticated;
  }
}

function hasAdminSession() {
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function buildAudit(order, action, note) {
  const existing = Array.isArray(order.audit) ? order.audit : [];
  return [
    {
      at: nowStamp(),
      action,
      by: "admin",
      note
    },
    ...existing
  ].slice(0, 40);
}

function loadOrders() {
  if (!orderStore) {
    allOrders = [];
    return;
  }

  allOrders = orderStore.getOrders();
}

function getFilteredOrders() {
  const query = (orderSearchInput?.value || "").trim().toLowerCase();
  const statusFilter = orderStatusFilter?.value || "All";

  return allOrders.filter((order) => {
    const statusOk = statusFilter === "All" || order.status === statusFilter;
    if (!statusOk) {
      return false;
    }

    if (!query) {
      return true;
    }

    const itemText = Array.isArray(order.items)
      ? order.items
          .map((item) => `${item.name} ${item.quantity}`)
          .join(" ")
          .toLowerCase()
      : "";

    const combined = [
      order.id,
      order.customer?.name,
      order.customer?.phone,
      order.customer?.serviceType,
      order.customer?.address,
      order.customer?.tableOrSlot,
      order.customer?.paymentMethod,
      order.customer?.notes,
      itemText
    ]
      .join(" ")
      .toLowerCase();

    return combined.includes(query);
  });
}

function updateSummary() {
  const total = allOrders.length;
  const active = allOrders.filter((order) => ACTIVE_STATUSES.has(order.status)).length;
  const cancelled = allOrders.filter((order) => order.status === "Cancelled").length;
  const revenue = allOrders
    .filter((order) => order.status !== "Cancelled")
    .reduce((sum, order) => sum + Number(order.totals?.total || 0), 0);

  if (summaryTotal) {
    summaryTotal.textContent = String(total);
  }
  if (summaryActive) {
    summaryActive.textContent = String(active);
  }
  if (summaryCancelled) {
    summaryCancelled.textContent = String(cancelled);
  }
  if (summaryRevenue) {
    summaryRevenue.textContent = formatCurrency(revenue);
  }
}

function buildStatusOptions(selectedStatus) {
  return ORDER_STATUSES.map((status) => {
    const selected = status === selectedStatus ? "selected" : "";
    return `<option value="${status}" ${selected}>${status}</option>`;
  }).join("");
}

function renderOrderCard(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const orderStatus = order.status || "Placed";

  const itemsHtml = items
    .map(
      (item) => `
      <li>
        <span>${escapeHtml(item.name)} x ${escapeHtml(item.quantity)}</span>
        <strong>${formatCurrency(Number(item.lineTotal || item.price * item.quantity || 0))}</strong>
      </li>
    `
    )
    .join("");

  const editRowsHtml = items
    .map(
      (item) => `
      <div class="item-row" data-item-row>
        <input type="text" class="item-name-input" value="${escapeHtml(item.name)}" required>
        <input type="number" class="item-qty-input" value="${Number(item.quantity) || 1}" min="0" required>
        <input type="number" class="item-price-input" value="${Number(item.price) || 1}" min="1" required>
      </div>
    `
    )
    .join("");

  return `
    <article class="order-card" data-order-id="${escapeHtml(order.id)}">
      <div class="order-top">
        <div>
          <h3 class="order-id">Order ${escapeHtml(order.id)}</h3>
          <div class="order-sub">
            Customer: ${escapeHtml(order.customer?.name || "Guest")} | ${escapeHtml(order.customer?.phone || "N/A")}<br>
            Created: ${escapeHtml(formatDate(order.createdAt))} | Updated: ${escapeHtml(formatDate(order.updatedAt))}
          </div>
        </div>
        <span class="status-badge ${statusClass(orderStatus)}">${escapeHtml(orderStatus)}</span>
      </div>

      <div class="order-layout">
        <ul class="order-items">${itemsHtml}</ul>

        <div class="order-meta">
          <div><span>Service</span><strong>${escapeHtml(order.customer?.serviceType || "Dine In")}</strong></div>
          <div><span>Payment</span><strong>${escapeHtml(order.customer?.paymentMethod || "UPI")}</strong></div>
          <div><span>Table/Slot</span><strong>${escapeHtml(order.customer?.tableOrSlot || "-")}</strong></div>
          <div><span>Address</span><strong>${escapeHtml(order.customer?.address || "-")}</strong></div>
          <div><span>Subtotal</span><strong>${formatCurrency(order.totals?.subtotal || 0)}</strong></div>
          <div><span>Total</span><strong>${formatCurrency(order.totals?.total || 0)}</strong></div>
        </div>
      </div>

      <div class="order-actions">
        <select class="status-select" data-order-id="${escapeHtml(order.id)}">
          ${buildStatusOptions(orderStatus)}
        </select>
        <button type="button" class="edit-toggle-btn" data-action="toggle-edit" data-order-id="${escapeHtml(order.id)}">Edit Order</button>
        <button type="button" class="cancel-btn" data-action="cancel-order" data-order-id="${escapeHtml(order.id)}">Cancel Order</button>
      </div>

      <form class="edit-form" data-order-id="${escapeHtml(order.id)}">
        <div class="edit-grid">
          <label>
            Customer Name
            <input type="text" name="customerName" value="${escapeHtml(order.customer?.name || "")}" required>
          </label>
          <label>
            Phone
            <input type="text" name="customerPhone" value="${escapeHtml(order.customer?.phone || "")}" required>
          </label>
          <label>
            Service Type
            <select name="serviceType" required>
              <option value="Dine In" ${order.customer?.serviceType === "Dine In" ? "selected" : ""}>Dine In</option>
              <option value="Takeaway" ${order.customer?.serviceType === "Takeaway" ? "selected" : ""}>Takeaway</option>
              <option value="Delivery" ${order.customer?.serviceType === "Delivery" ? "selected" : ""}>Delivery</option>
            </select>
          </label>
          <label>
            Table / Slot
            <input type="text" name="tableOrSlot" value="${escapeHtml(order.customer?.tableOrSlot || "")}">
          </label>
          <label>
            Payment
            <select name="paymentMethod" required>
              <option value="UPI" ${order.customer?.paymentMethod === "UPI" ? "selected" : ""}>UPI</option>
              <option value="Card" ${order.customer?.paymentMethod === "Card" ? "selected" : ""}>Card</option>
              <option value="Cash" ${order.customer?.paymentMethod === "Cash" ? "selected" : ""}>Cash</option>
            </select>
          </label>
          <label>
            Address
            <input type="text" name="address" value="${escapeHtml(order.customer?.address || "")}">
          </label>
        </div>

        <label>
          Notes
          <textarea name="notes" rows="2">${escapeHtml(order.customer?.notes || "")}</textarea>
        </label>

        <div class="edit-items">${editRowsHtml}</div>

        <div class="edit-actions">
          <button type="submit" class="save-btn">Save Changes</button>
          <button type="button" class="close-btn" data-action="close-edit" data-order-id="${escapeHtml(order.id)}">Close</button>
        </div>
      </form>
    </article>
  `;
}

function renderOrders() {
  if (!adminOrders) {
    return;
  }

  const filtered = getFilteredOrders();

  if (filtered.length === 0) {
    adminOrders.innerHTML = "<div class='empty-state'>No orders found for the selected filter.</div>";
    return;
  }

  adminOrders.innerHTML = filtered.map((order) => renderOrderCard(order)).join("");
}

function renderAll() {
  updateSummary();
  renderOrders();

  if (lastSyncText) {
    lastSyncText.textContent = `Last sync: ${formatDate(nowStamp())}`;
  }
}

function saveUpdatedOrder(orderId, updater, successMessage) {
  if (!orderStore) {
    setNotice("Order store is unavailable.", "error");
    return;
  }

  const updatedOrder = orderStore.updateOrder(orderId, updater);
  if (!updatedOrder) {
    setNotice("Order not found.", "error");
    return;
  }

  loadOrders();
  renderAll();
  setNotice(successMessage, "success");
}

function handleDeleteAllOrders() {
  if (!orderStore || typeof orderStore.replaceOrders !== "function") {
    setNotice("Order store is unavailable.", "error");
    return;
  }

  if (allOrders.length === 0) {
    setNotice("No orders available to delete.", "error");
    return;
  }

  const confirmed = window.confirm("Delete all orders? This action cannot be undone.");
  if (!confirmed) {
    return;
  }

  orderStore.replaceOrders([], { action: "cleared-all", by: "admin", at: nowStamp() });
  loadOrders();
  renderAll();
  setNotice("All orders deleted successfully.", "success");
}

function handleStatusChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.matches(".status-select")) {
    return;
  }

  const orderId = target.dataset.orderId;
  const nextStatus = target.value;

  if (!orderId || !ORDER_STATUSES.includes(nextStatus)) {
    return;
  }

  saveUpdatedOrder(
    orderId,
    (order) => ({
      ...order,
      status: nextStatus,
      updatedAt: nowStamp(),
      audit: buildAudit(order, "status-updated", `Status changed to ${nextStatus}`)
    }),
    `Order ${orderId} status updated to ${nextStatus}.`
  );
}

function handleCardClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionElement = target.closest("[data-action]");
  if (!(actionElement instanceof HTMLElement)) {
    return;
  }

  const action = actionElement.dataset.action;
  const orderId = actionElement.dataset.orderId;

  if (!action || !orderId) {
    return;
  }

  const card = actionElement.closest("[data-order-id]");
  const editForm = card?.querySelector(".edit-form");

  if (action === "toggle-edit" && editForm instanceof HTMLFormElement) {
    editForm.classList.toggle("is-open");
    return;
  }

  if (action === "close-edit" && editForm instanceof HTMLFormElement) {
    editForm.classList.remove("is-open");
    return;
  }

  if (action === "cancel-order") {
    saveUpdatedOrder(
      orderId,
      (order) => ({
        ...order,
        status: "Cancelled",
        updatedAt: nowStamp(),
        audit: buildAudit(order, "cancelled", "Order cancelled by admin")
      }),
      `Order ${orderId} cancelled.`
    );
  }
}

function parseEditedItems(editForm) {
  const rows = Array.from(editForm.querySelectorAll("[data-item-row]"));

  const items = rows
    .map((row) => {
      const nameInput = row.querySelector(".item-name-input");
      const qtyInput = row.querySelector(".item-qty-input");
      const priceInput = row.querySelector(".item-price-input");

      if (!(nameInput instanceof HTMLInputElement)) {
        return null;
      }
      if (!(qtyInput instanceof HTMLInputElement)) {
        return null;
      }
      if (!(priceInput instanceof HTMLInputElement)) {
        return null;
      }

      const name = nameInput.value.trim();
      const quantity = Number(qtyInput.value);
      const price = Number(priceInput.value);

      if (!name || !Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) {
        return null;
      }

      return {
        name,
        quantity,
        price,
        lineTotal: quantity * price
      };
    })
    .filter(Boolean);

  return items;
}

function handleEditSubmit(event) {
  const target = event.target;
  if (!(target instanceof HTMLFormElement) || !target.matches(".edit-form")) {
    return;
  }

  event.preventDefault();

  const orderId = target.dataset.orderId;
  if (!orderId) {
    return;
  }

  const editedItems = parseEditedItems(target);
  if (editedItems.length === 0) {
    setNotice("At least one valid item is required to save order changes.", "error");
    return;
  }

  const formData = new FormData(target);
  const serviceType = String(formData.get("serviceType") || "Dine In");
  const subtotal = editedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const gst = subtotal * 0.05;
  const deliveryFee = serviceType === "Delivery" ? 49 : 0;
  const total = subtotal + gst + deliveryFee;

  saveUpdatedOrder(
    orderId,
    (order) => ({
      ...order,
      updatedAt: nowStamp(),
      customer: {
        name: String(formData.get("customerName") || "").trim(),
        phone: String(formData.get("customerPhone") || "").trim(),
        serviceType,
        tableOrSlot: String(formData.get("tableOrSlot") || "").trim(),
        address: String(formData.get("address") || "").trim(),
        paymentMethod: String(formData.get("paymentMethod") || "UPI"),
        notes: String(formData.get("notes") || "").trim()
      },
      items: editedItems,
      totals: {
        subtotal,
        gst,
        deliveryFee,
        total
      },
      audit: buildAudit(order, "edited", "Order details updated by admin")
    }),
    `Order ${orderId} updated successfully.`
  );
}

function initAdminPanel() {
  if (!orderStore) {
    setNotice("Order data store failed to load. Check orders-store.js.", "error");
    return;
  }

  loadOrders();
  renderAll();

  if (adminInitialized) {
    return;
  }

  orderSearchInput?.addEventListener("input", renderOrders);
  orderStatusFilter?.addEventListener("change", renderOrders);

  refreshOrdersBtn?.addEventListener("click", () => {
    loadOrders();
    renderAll();
    setNotice("Orders refreshed.", "success");
  });

  deleteAllOrdersBtn?.addEventListener("click", handleDeleteAllOrders);

  adminOrders?.addEventListener("change", handleStatusChange);
  adminOrders?.addEventListener("click", handleCardClick);
  adminOrders?.addEventListener("submit", handleEditSubmit);

  orderStore.subscribe((eventType, payload) => {
    if (eventType !== "orders:changed") {
      return;
    }

    if (payload?.orders && Array.isArray(payload.orders)) {
      allOrders = payload.orders;
    } else {
      loadOrders();
    }

    renderAll();
  });

  adminInitialized = true;
}

function loginIsValid(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function handleGateSubmit(event) {
  event.preventDefault();

  const username = adminUsernameInput instanceof HTMLInputElement ? adminUsernameInput.value.trim() : "";
  const password = adminPasswordInput instanceof HTMLInputElement ? adminPasswordInput.value : "";

  if (!loginIsValid(username, password)) {
    setGateMessage("Invalid credentials. Try again.");
    setNotice("", "");
    return;
  }

  window.sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  setAuthState(true);
  setGateMessage("");
  setNotice("Admin access unlocked.", "success");

  if (adminGateForm instanceof HTMLFormElement) {
    adminGateForm.reset();
  }

  if (adminPasswordInput instanceof HTMLInputElement) {
    adminPasswordInput.type = "password";
  }

  if (togglePasswordBtn instanceof HTMLButtonElement) {
    togglePasswordBtn.setAttribute("aria-pressed", "false");
    togglePasswordBtn.setAttribute("aria-label", "Show password");
    togglePasswordBtn.title = "Show password";
    togglePasswordBtn.classList.remove("is-active");
  }

  initAdminPanel();
}

function handleLogout() {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  setAuthState(false);
  setNotice("", "");
  setGateMessage("Logged out. Enter credentials to continue.");

  if (adminPasswordInput instanceof HTMLInputElement) {
    adminPasswordInput.type = "password";
  }

  if (togglePasswordBtn instanceof HTMLButtonElement) {
    togglePasswordBtn.setAttribute("aria-pressed", "false");
    togglePasswordBtn.setAttribute("aria-label", "Show password");
    togglePasswordBtn.title = "Show password";
    togglePasswordBtn.classList.remove("is-active");
  }
}

function handleTogglePasswordVisibility() {
  if (!(adminPasswordInput instanceof HTMLInputElement)) {
    return;
  }

  if (!(togglePasswordBtn instanceof HTMLButtonElement)) {
    return;
  }

  const isHidden = adminPasswordInput.type === "password";
  adminPasswordInput.type = isHidden ? "text" : "password";
  togglePasswordBtn.setAttribute("aria-pressed", String(isHidden));
  togglePasswordBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  togglePasswordBtn.title = isHidden ? "Hide password" : "Show password";
  togglePasswordBtn.classList.toggle("is-active", isHidden);
}

function bootstrapAdminAccess() {
  setAuthState(false);

  if (adminGateForm instanceof HTMLFormElement) {
    adminGateForm.addEventListener("submit", handleGateSubmit);
  }

  if (logoutBtn instanceof HTMLButtonElement) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  if (togglePasswordBtn instanceof HTMLButtonElement) {
    togglePasswordBtn.addEventListener("click", handleTogglePasswordVisibility);
  }

  if (hasAdminSession()) {
    setAuthState(true);
    setGateMessage("");
    initAdminPanel();
    return;
  }

  setGateMessage("Enter admin credentials to continue.");
}

bootstrapAdminAccess();
