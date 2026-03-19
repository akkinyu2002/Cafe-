const menuItems = [
  {
    id: "c1",
    name: "Irani Caramel Latte",
    category: "coffee",
    price: 220,
    desc: "Double-shot espresso, caramel swirl, velvet milk foam.",
    rating: 4.8
  },
  {
    id: "c2",
    name: "Cold Brew Hazelnut",
    category: "coffee",
    price: 240,
    desc: "18-hour brew, toasted hazelnut notes, smooth finish.",
    rating: 4.7
  },
  {
    id: "c3",
    name: "Saffron Cappuccino",
    category: "coffee",
    price: 210,
    desc: "Aromatic saffron milk with rich cappuccino crema.",
    rating: 4.9
  },
  {
    id: "m1",
    name: "Mint Lemon Fizz",
    category: "mocktail",
    price: 180,
    desc: "Crushed mint, lemon zest, sparkling soda.",
    rating: 4.6
  },
  {
    id: "m2",
    name: "Charminar Sunset",
    category: "mocktail",
    price: 260,
    desc: "Orange-pomegranate blend with smoked cinnamon rim.",
    rating: 4.8
  },
  {
    id: "m3",
    name: "Rose Falooda Cooler",
    category: "mocktail",
    price: 230,
    desc: "Rose milk, basil seeds, vermicelli, vanilla ice cream.",
    rating: 4.7
  },
  {
    id: "f1",
    name: "Hyderabadi Chicken Mandi",
    category: "meal",
    price: 640,
    desc: "Tender mandi rice with spiced chicken and garlic dip.",
    rating: 4.9
  },
  {
    id: "f2",
    name: "Paneer Tikka Sizzler",
    category: "meal",
    price: 520,
    desc: "Smoky paneer, grilled vegetables, butter naan strips.",
    rating: 4.7
  },
  {
    id: "f3",
    name: "Nizam Gourmet Burger",
    category: "meal",
    price: 430,
    desc: "Juicy patty, peri fries, smoked chilli aioli.",
    rating: 4.6
  },
  {
    id: "d1",
    name: "Qubani Cheesecake",
    category: "dessert",
    price: 290,
    desc: "Apricot compote cheesecake inspired by old-city flavors.",
    rating: 4.9
  },
  {
    id: "d2",
    name: "Kunafa Cream Bowl",
    category: "dessert",
    price: 310,
    desc: "Crispy kunafa, pistachio cream, saffron syrup.",
    rating: 4.8
  },
  {
    id: "d3",
    name: "Chocolate Lava Jar",
    category: "dessert",
    price: 270,
    desc: "Warm chocolate center with vanilla bean cream.",
    rating: 4.7
  }
];

const STORAGE_KEY = "cbh_cart_v1";

const state = {
  category: "all",
  query: "",
  sort: "popular",
  cart: {}
};

const menuGrid = document.getElementById("menuGrid");
const cartItemsEl = document.getElementById("cartItems");
const cartCountEl = document.getElementById("cartCount");
const subtotalEl = document.getElementById("subtotal");
const gstEl = document.getElementById("gst");
const serviceEl = document.getElementById("service");
const deliveryFeeEl = document.getElementById("deliveryFee");
const totalEl = document.getElementById("total");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const toast = document.getElementById("toast");
const orderStatus = document.getElementById("orderStatus");
const orderSummary = document.getElementById("orderSummary");
const floatingCart = document.getElementById("floatingCart");
const floatingCartCount = document.getElementById("floatingCartCount");
const menuSearch = document.getElementById("menuSearch");
const menuSort = document.getElementById("menuSort");
const categoryFilters = document.getElementById("categoryFilters");
const checkoutForm = document.getElementById("checkoutForm");
const orderType = document.getElementById("orderType");
const addressWrap = document.getElementById("addressWrap");
const zoneWrap = document.getElementById("zoneWrap");
const deliveryZone = document.getElementById("deliveryZone");
const tableWrap = document.getElementById("tableWrap");
const siteHeader = document.querySelector(".site-header");
const navLinks = [...document.querySelectorAll(".main-nav a")];

function formatINR(value) {
  return `Rs ${value.toLocaleString("en-IN")}`;
}

function getDietTag(item) {
  if (item.name.includes("Chicken")) {
    return "Non-Veg";
  }
  return "Veg";
}

function getFlavorTag(item) {
  if (item.category === "meal") {
    return "Medium Spice";
  }
  if (item.category === "mocktail") {
    return "Refreshing";
  }
  if (item.category === "dessert") {
    return "Sweet";
  }
  return "Bold Roast";
}

function getDeliveryFee() {
  if (orderType.value !== "delivery") {
    return 0;
  }

  const zone = deliveryZone.value;
  if (zone === "core") {
    return 40;
  }
  if (zone === "extended") {
    return 70;
  }
  if (zone === "outer") {
    return 110;
  }
  return 0;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function persistCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
}

function loadCart() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === "object") {
      state.cart = parsed;
    }
  } catch (_error) {
    state.cart = {};
  }
}

function getFilteredMenu() {
  const filtered = menuItems.filter((item) => {
    const categoryMatch = state.category === "all" || item.category === state.category;
    const queryMatch =
      state.query.trim() === "" ||
      item.name.toLowerCase().includes(state.query.toLowerCase()) ||
      item.desc.toLowerCase().includes(state.query.toLowerCase());
    return categoryMatch && queryMatch;
  });

  const sorted = [...filtered];

  if (state.sort === "price-low") {
    sorted.sort((a, b) => a.price - b.price);
  } else if (state.sort === "price-high") {
    sorted.sort((a, b) => b.price - a.price);
  } else if (state.sort === "rating-high") {
    sorted.sort((a, b) => b.rating - a.rating);
  }

  return sorted;
}

function renderMenu() {
  const filtered = getFilteredMenu();

  if (!filtered.length) {
    menuGrid.innerHTML = '<div class="menu-empty">No menu item found. Try another search or category.</div>';
    return;
  }

  menuGrid.innerHTML = filtered
    .map(
      (item) => `
      <article class="menu-card">
        <span class="menu-tag">${item.category}</span>
        <h3>${item.name}</h3>
        <p>${item.desc}</p>
        <div class="menu-badges">
          <span class="badge diet">${getDietTag(item)}</span>
          <span class="badge flavor">${getFlavorTag(item)}</span>
        </div>
        <div class="menu-meta">
          <span>${formatINR(item.price)}</span>
          <span>Rating ${item.rating}</span>
        </div>
        <div class="card-actions">
          <div class="qty-wrap" data-qty-wrap>
            <button type="button" data-action="minus">-</button>
            <input type="number" min="1" max="10" value="1" data-qty-input />
            <button type="button" data-action="plus">+</button>
          </div>
          <button class="btn btn-small btn-soft" data-add-id="${item.id}">Add to Cart</button>
        </div>
      </article>
    `
    )
    .join("");
}

function getCartItemCount() {
  return Object.values(state.cart).reduce((acc, item) => acc + item.qty, 0);
}

function getPriceTotals() {
  const subtotal = Object.values(state.cart).reduce((sum, item) => sum + item.price * item.qty, 0);
  const gst = Math.round(subtotal * 0.05);
  const service = Math.round(subtotal * 0.08);
  const deliveryFee = getDeliveryFee();
  const total = subtotal + gst + service + deliveryFee;
  return { subtotal, gst, service, deliveryFee, total };
}

function buildCartRows() {
  const entries = Object.values(state.cart);

  if (!entries.length) {
    return `
      <div class="cart-empty">
        <p>Your cart is empty. Add items from the menu.</p>
        <button type="button" class="btn btn-small btn-soft" data-open-menu>Browse Menu</button>
      </div>
    `;
  }

  return entries
    .map(
      (entry) => `
      <article class="cart-item">
        <div class="cart-item-top">
          <h4>${entry.name}</h4>
          <span class="cart-item-price">${formatINR(entry.price * entry.qty)}</span>
        </div>
        <div class="cart-item-controls">
          <div class="qty-wrap">
            <button type="button" data-cart-action="minus" data-cart-id="${entry.id}">-</button>
            <input type="number" value="${entry.qty}" readonly />
            <button type="button" data-cart-action="plus" data-cart-id="${entry.id}">+</button>
          </div>
          <button class="remove" type="button" data-remove-id="${entry.id}">Remove</button>
        </div>
      </article>
      `
    )
    .join("");
}

function renderCart() {
  const totals = getPriceTotals();
  const itemCount = getCartItemCount();

  cartItemsEl.innerHTML = buildCartRows();
  cartCountEl.textContent = String(itemCount);
  floatingCartCount.textContent = String(itemCount);
  if (itemCount > 0) {
    floatingCart.classList.add("show");
  } else {
    floatingCart.classList.remove("show");
  }

  subtotalEl.textContent = formatINR(totals.subtotal);
  gstEl.textContent = formatINR(totals.gst);
  serviceEl.textContent = formatINR(totals.service);
  deliveryFeeEl.textContent = formatINR(totals.deliveryFee);
  totalEl.textContent = formatINR(totals.total);
}

function addItemToCart(itemId, qty) {
  const menuItem = menuItems.find((item) => item.id === itemId);
  if (!menuItem) {
    return;
  }

  if (!state.cart[itemId]) {
    state.cart[itemId] = {
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      qty: 0
    };
  }

  state.cart[itemId].qty += qty;
  renderCart();
  persistCart();
  showToast(`${menuItem.name} added to cart`);
}

function updateCartQty(itemId, direction) {
  const current = state.cart[itemId];
  if (!current) {
    return;
  }

  current.qty += direction === "plus" ? 1 : -1;

  if (current.qty <= 0) {
    delete state.cart[itemId];
  }

  renderCart();
  persistCart();
}

function removeCartItem(itemId) {
  delete state.cart[itemId];
  renderCart();
  persistCart();
  showToast("Item removed from cart");
}

function openCart() {
  cartDrawer.classList.add("open");
  overlay.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  cartDrawer.classList.remove("open");
  overlay.classList.remove("show");
  document.body.style.overflow = "";
}

function setOrderTypeUI() {
  const selected = orderType.value;

  if (selected === "delivery") {
    addressWrap.classList.remove("hidden");
    zoneWrap.classList.remove("hidden");
    tableWrap.classList.add("hidden");
    addressWrap.querySelector("textarea").setAttribute("required", "required");
    deliveryZone.setAttribute("required", "required");
    renderCart();
    return;
  }

  if (selected === "dinein") {
    tableWrap.classList.remove("hidden");
    addressWrap.classList.add("hidden");
    zoneWrap.classList.add("hidden");
    addressWrap.querySelector("textarea").removeAttribute("required");
    deliveryZone.removeAttribute("required");
    deliveryZone.value = "";
    renderCart();
    return;
  }

  addressWrap.classList.add("hidden");
  zoneWrap.classList.add("hidden");
  tableWrap.classList.add("hidden");
  addressWrap.querySelector("textarea").removeAttribute("required");
  deliveryZone.removeAttribute("required");
  deliveryZone.value = "";
  renderCart();
}

function generateOrderId() {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CBH${new Date().getFullYear()}${random}`;
}

function setCheckoutBusy(isBusy) {
  const submitBtn = checkoutForm.querySelector('button[type="submit"]');
  if (!submitBtn) {
    return;
  }

  submitBtn.disabled = isBusy;
  submitBtn.textContent = isBusy ? "Placing order..." : "Confirm & Place Order";
}

async function handlePlaceOrder(event) {
  event.preventDefault();

  const itemCount = getCartItemCount();
  if (!itemCount) {
    showToast("Please add items before placing an order");
    return;
  }

  const formData = new FormData(checkoutForm);
  const selectedType = formData.get("orderType");

  if (selectedType === "delivery" && !String(formData.get("address")).trim()) {
    showToast("Delivery address is required");
    return;
  }

  if (selectedType === "delivery" && !String(formData.get("deliveryZone")).trim()) {
    showToast("Please select a delivery zone");
    return;
  }

  const totals = getPriceTotals();
  let eta = "Ready in 15 mins";
  if (selectedType === "pickup") {
    eta = "20-25 mins";
  }
  if (selectedType === "delivery") {
    const zone = String(formData.get("deliveryZone"));
    eta = zone === "outer" ? "45-60 mins" : zone === "extended" ? "40-50 mins" : "30-40 mins";
  }
  const orderId = generateOrderId();
  const customerName = String(formData.get("customerName"));

  orderStatus.textContent = `Order confirmed, ${customerName}. Order ID: ${orderId}. Estimated time: ${eta}.`;
  orderSummary.innerHTML = `
    <strong>Last Order Summary</strong><br />
    Items: ${itemCount}<br />
    Type: ${String(selectedType)}<br />
    Total Paid: ${formatINR(totals.total)}
  `;
  orderSummary.classList.add("show");
  showToast("Order placed successfully");

  setCheckoutBusy(true);
  await new Promise((resolve) => setTimeout(resolve, 700));
  setCheckoutBusy(false);

  state.cart = {};
  renderCart();
  persistCart();
  checkoutForm.reset();
  orderType.value = "delivery";
  setOrderTypeUI();
}

function bindMenuInteractions() {
  menuGrid.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.addId) {
      const card = target.closest(".menu-card");
      if (!card) {
        return;
      }
      const qtyInput = card.querySelector("[data-qty-input]");
      const qty = Number(qtyInput.value);
      addItemToCart(target.dataset.addId, Number.isNaN(qty) ? 1 : Math.max(1, Math.min(10, qty)));
      qtyInput.value = "1";
      return;
    }

    const action = target.dataset.action;
    if (action) {
      const qtyWrap = target.closest("[data-qty-wrap]");
      if (!qtyWrap) {
        return;
      }

      const qtyInput = qtyWrap.querySelector("[data-qty-input]");
      let qty = Number(qtyInput.value) || 1;

      qty = action === "plus" ? qty + 1 : qty - 1;
      qty = Math.max(1, Math.min(10, qty));
      qtyInput.value = String(qty);
    }
  });

  menuGrid.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches("[data-qty-input]")) {
      return;
    }

    let value = Number(target.value);
    if (Number.isNaN(value)) {
      value = 1;
    }

    target.value = String(Math.max(1, Math.min(10, value)));
  });
}

function bindCartInteractions() {
  cartItemsEl.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.removeId) {
      removeCartItem(target.dataset.removeId);
      return;
    }

    if (target.dataset.cartAction && target.dataset.cartId) {
      updateCartQty(target.dataset.cartId, target.dataset.cartAction);
      return;
    }

    if (target.dataset.openMenu !== undefined) {
      closeCart();
      document.getElementById("menu").scrollIntoView({ behavior: "smooth" });
    }
  });
}

function bindCategoryFilters() {
  categoryFilters.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const nextCategory = target.dataset.category;
    if (!nextCategory) {
      return;
    }

    state.category = nextCategory;
    [...categoryFilters.querySelectorAll(".chip")].forEach((chip) => chip.classList.remove("active"));
    target.classList.add("active");
    renderMenu();
  });
}

function bindSpecialCombos() {
  document.querySelectorAll(".add-special").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".special-card");
      if (!card) {
        return;
      }

      const id = card.dataset.id;
      const name = card.dataset.name;
      const price = Number(card.dataset.price);

      if (!id || !name || !price) {
        return;
      }

      if (!state.cart[id]) {
        state.cart[id] = { id, name, price, qty: 0 };
      }

      state.cart[id].qty += 1;
      renderCart();
      persistCart();
      showToast(`${name} added to cart`);
    });
  });
}

function bindBookingForm() {
  const bookingForm = document.getElementById("bookingForm");
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(bookingForm);
    const name = String(data.get("name"));
    const date = String(data.get("date"));
    const time = String(data.get("time"));

    showToast(`Table booked for ${name} on ${date} at ${time}`);
    bookingForm.reset();
  });
}

function bindTopLevelActions() {
  document.getElementById("cartToggle").addEventListener("click", openCart);
  floatingCart.addEventListener("click", openCart);
  document.getElementById("closeCart").addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);

  document.getElementById("quickOrderBtn").addEventListener("click", () => {
    openCart();
    if (!getCartItemCount()) {
      showToast("Add your favorites from the menu and place the order");
    }
  });

  document.getElementById("scrollTopBtn").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function bindHeaderState() {
  const updateHeader = () => {
    if (window.scrollY > 8) {
      siteHeader.classList.add("scrolled");
    } else {
      siteHeader.classList.remove("scrolled");
    }
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

function bindNavHighlight() {
  const sectionMap = navLinks
    .map((link) => {
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) {
        return null;
      }
      return { link, section: document.querySelector(href) };
    })
    .filter((entry) => entry && entry.section);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        sectionMap.forEach((item) => item.link.classList.remove("active"));
        const match = sectionMap.find((item) => item.section === entry.target);
        if (match) {
          match.link.classList.add("active");
        }
      });
    },
    { threshold: 0.35 }
  );

  sectionMap.forEach((item) => observer.observe(item.section));
}

function bindSearch() {
  menuSearch.addEventListener("input", () => {
    state.query = menuSearch.value;
    renderMenu();
  });
}

function bindSort() {
  menuSort.addEventListener("change", () => {
    state.sort = menuSort.value;
    renderMenu();
  });
}

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const ctrlOrCmd = event.ctrlKey || event.metaKey;

    if (key === "escape" && cartDrawer.classList.contains("open")) {
      closeCart();
    }

    if (ctrlOrCmd && key === "k") {
      event.preventDefault();
      menuSearch.focus();
    }

    if (ctrlOrCmd && key === "b") {
      event.preventDefault();
      openCart();
    }
  });
}

function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

function init() {
  loadCart();
  renderMenu();
  renderCart();
  setOrderTypeUI();

  bindMenuInteractions();
  bindCartInteractions();
  bindCategoryFilters();
  bindSpecialCombos();
  bindBookingForm();
  bindTopLevelActions();
  bindHeaderState();
  bindNavHighlight();
  bindSearch();
  bindSort();
  bindKeyboardShortcuts();
  initReveal();

  orderType.addEventListener("change", setOrderTypeUI);
  deliveryZone.addEventListener("change", renderCart);
  checkoutForm.addEventListener("submit", handlePlaceOrder);
}

init();

