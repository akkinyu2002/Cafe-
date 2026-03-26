const orderStore = window.KanigiriOrders || null;

const mobileNavToggle = document.getElementById("mobileNavToggle");
const primaryNav = document.getElementById("primaryNav");
const carouselTrack = document.getElementById("carouselTrack");
const carouselWindow = document.getElementById("carouselWindow");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const dishCards = document.querySelectorAll(".dish-card");
const loadRevealElements = document.querySelectorAll(".reveal-on-load");
const scrollRevealElements = document.querySelectorAll(".reveal-on-scroll");
const gotoMenuLinks = document.querySelectorAll(".goto-menu");
const addItemButtons = document.querySelectorAll(".add-item-btn");
const heroSlides = Array.from(document.querySelectorAll(".hero-slide"));
const heroSliderDots = Array.from(document.querySelectorAll(".hero-slider-dot"));
const heroSliderPrev = document.getElementById("heroSliderPrev");
const heroSliderNext = document.getElementById("heroSliderNext");
const heroSliderDotsWrap = document.getElementById("heroSliderDots");
const heroPlateCard = document.getElementById("heroPlateCard");
const heroDishPrice = document.getElementById("heroDishPrice");
const heroDishOldPrice = document.getElementById("heroDishOldPrice");
const heroDishMain = document.getElementById("heroDishMain");
const heroDishTail = document.getElementById("heroDishTail");
const heroDishRating = document.getElementById("heroDishRating");
const heroDishReviews = document.getElementById("heroDishReviews");
const heroDishDescription = document.getElementById("heroDishDescription");
const heroDishStars = document.getElementById("heroDishStars");

const cartItemsElement = document.getElementById("cartItems");
const cartEmptyState = document.getElementById("cartEmptyState");
const subtotalAmount = document.getElementById("subtotalAmount");
const gstAmount = document.getElementById("gstAmount");
const deliveryAmount = document.getElementById("deliveryAmount");
const totalAmount = document.getElementById("totalAmount");
const serviceType = document.getElementById("serviceType");
const deliveryAddress = document.getElementById("deliveryAddress");
const checkoutForm = document.getElementById("checkoutForm");
const orderMessage = document.getElementById("orderMessage");
const toastStack = document.getElementById("toastStack");

let currentIndex = 0;
let heroSlideIndex = 0;
let heroSliderTimer = null;
const HERO_SLIDE_INTERVAL_MS = 5200;
const cart = new Map();

function formatCurrency(value) {
  return `Rs ${Math.round(value)}`;
}

function getOrderType() {
  return serviceType?.value || "Dine In";
}

function getPaymentMethod() {
  const paymentField = checkoutForm?.querySelector("input[name='paymentMethod']:checked");
  return paymentField instanceof HTMLInputElement ? paymentField.value : "UPI";
}

function getStepWidth() {
  const firstCard = carouselTrack?.children?.[0];
  if (!firstCard) {
    return 0;
  }

  const cardRect = firstCard.getBoundingClientRect();
  const trackStyle = window.getComputedStyle(carouselTrack);
  const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap || "0") || 0;

  return cardRect.width + gap;
}

function getMaxIndex() {
  if (!carouselTrack || !carouselWindow) {
    return 0;
  }

  const step = getStepWidth();
  if (step === 0) {
    return 0;
  }

  const hiddenWidth = carouselTrack.scrollWidth - carouselWindow.clientWidth;
  return Math.max(0, Math.ceil(hiddenWidth / step));
}

function syncCarousel() {
  if (!carouselTrack) {
    return;
  }

  const maxIndex = getMaxIndex();
  currentIndex = Math.min(Math.max(currentIndex, 0), maxIndex);

  const step = getStepWidth();
  carouselTrack.style.transform = `translateX(-${currentIndex * step}px)`;

  if (prevBtn) {
    prevBtn.disabled = currentIndex <= 0;
  }

  if (nextBtn) {
    nextBtn.disabled = currentIndex >= maxIndex;
  }
}

function stopHeroSlider() {
  if (heroSliderTimer === null) {
    return;
  }

  window.clearInterval(heroSliderTimer);
  heroSliderTimer = null;
}

function startHeroSlider() {
  stopHeroSlider();

  if (heroSlides.length < 2) {
    return;
  }

  heroSliderTimer = window.setInterval(() => {
    updateHeroSlide(heroSlideIndex + 1);
  }, HERO_SLIDE_INTERVAL_MS);
}

function updateHeroSlide(index) {
  if (heroSlides.length === 0) {
    return;
  }

  const totalSlides = heroSlides.length;
  heroSlideIndex = ((index % totalSlides) + totalSlides) % totalSlides;
  const activeSlide = heroSlides[heroSlideIndex];

  heroSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === heroSlideIndex);
  });

  heroSliderDots.forEach((dot, dotIndex) => {
    const isActive = dotIndex === heroSlideIndex;
    dot.classList.toggle("is-active", isActive);
    dot.setAttribute("aria-current", isActive ? "true" : "false");
  });

  if (!activeSlide) {
    return;
  }

  if (heroDishMain) {
    heroDishMain.textContent = activeSlide.dataset.main || "";
  }

  if (heroDishTail) {
    heroDishTail.textContent = activeSlide.dataset.tail || "";
  }

  const currentPrice = Number.parseFloat(activeSlide.dataset.price || "");
  if (heroDishPrice && Number.isFinite(currentPrice) && currentPrice > 0) {
    heroDishPrice.textContent = formatCurrency(currentPrice);
  }

  const previousPrice = Number.parseFloat(activeSlide.dataset.oldPrice || "");
  if (heroDishOldPrice) {
    if (Number.isFinite(previousPrice) && previousPrice > 0) {
      heroDishOldPrice.textContent = formatCurrency(previousPrice);
      heroDishOldPrice.hidden = false;
    } else {
      heroDishOldPrice.textContent = "";
      heroDishOldPrice.hidden = true;
    }
  }

  if (heroDishRating) {
    heroDishRating.textContent = activeSlide.dataset.rating || "";
  }

  if (heroDishReviews) {
    heroDishReviews.textContent = activeSlide.dataset.reviews || "";
  }

  if (heroDishDescription) {
    heroDishDescription.textContent = activeSlide.dataset.description || "";
  }

  if (heroDishStars) {
    const rating = activeSlide.dataset.rating || "4.5";
    heroDishStars.setAttribute("aria-label", `Rated ${rating} out of 5`);
  }
}

function setMessage(message, type) {
  if (!orderMessage) {
    return;
  }

  orderMessage.textContent = message;
  orderMessage.classList.remove("success", "error");

  if (type) {
    orderMessage.classList.add(type);
  }
}

function showToast(message, type) {
  if (!toastStack || !message) {
    return;
  }

  const toast = document.createElement("div");
  toast.classList.add("toast");
  toast.classList.add(type === "error" ? "error" : "success");
  toast.textContent = message;
  toastStack.appendChild(toast);

  window.requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      toast.remove();
    }, 220);
  }, 2600);
}

function getCartSubtotal() {
  let subtotal = 0;
  cart.forEach((item) => {
    subtotal += item.price * item.quantity;
  });
  return subtotal;
}

function getBillingSnapshot() {
  const subtotal = getCartSubtotal();
  const gst = subtotal * 0.05;
  const deliveryFee = getOrderType() === "Delivery" && subtotal > 0 ? 49 : 0;
  const total = subtotal + gst + deliveryFee;

  return {
    subtotal,
    gst,
    deliveryFee,
    total
  };
}

function updateTotals() {
  const billing = getBillingSnapshot();

  if (subtotalAmount) {
    subtotalAmount.textContent = formatCurrency(billing.subtotal);
  }
  if (gstAmount) {
    gstAmount.textContent = formatCurrency(billing.gst);
  }
  if (deliveryAmount) {
    deliveryAmount.textContent = formatCurrency(billing.deliveryFee);
  }
  if (totalAmount) {
    totalAmount.textContent = formatCurrency(billing.total);
  }
}

function renderCart() {
  if (!cartItemsElement || !cartEmptyState) {
    return;
  }

  if (cart.size === 0) {
    cartItemsElement.innerHTML = "";
    cartEmptyState.style.display = "block";
    updateTotals();
    return;
  }

  cartEmptyState.style.display = "none";

  const itemsHtml = Array.from(cart.entries())
    .map(([name, item]) => {
      const lineTotal = item.price * item.quantity;
      return `
        <li class="cart-item">
          <div>
            <div class="cart-item-name">${name}</div>
            <div class="cart-item-sub">${formatCurrency(item.price)} each | Line: ${formatCurrency(lineTotal)}</div>
          </div>
          <div class="cart-item-controls">
            <button type="button" class="qty-btn" data-item="${name}" data-action="decrease" aria-label="Decrease quantity">-</button>
            <span class="qty-value">${item.quantity}</span>
            <button type="button" class="qty-btn" data-item="${name}" data-action="increase" aria-label="Increase quantity">+</button>
          </div>
        </li>
      `;
    })
    .join("");

  cartItemsElement.innerHTML = itemsHtml;
  updateTotals();
}

function addItemToCart(name, price) {
  const existing = cart.get(name);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.set(name, { price, quantity: 1 });
  }

  renderCart();
}

function updateItemQuantity(name, action) {
  const existing = cart.get(name);
  if (!existing) {
    return;
  }

  if (action === "increase") {
    existing.quantity += 1;
  }

  if (action === "decrease") {
    existing.quantity -= 1;
    if (existing.quantity <= 0) {
      cart.delete(name);
    }
  }

  renderCart();
}

function setDeliveryRequirement() {
  if (!deliveryAddress || !serviceType) {
    return;
  }

  if (serviceType.value === "Delivery") {
    deliveryAddress.required = true;
    deliveryAddress.placeholder = "Please provide full delivery address";
  } else {
    deliveryAddress.required = false;
    deliveryAddress.placeholder = "Required only for Delivery";
  }
}

function generateOrderId() {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 90 + 10);
  return `HYD${stamp}${rand}`;
}

function buildOrderPayload() {
  const billing = getBillingSnapshot();
  const customerNameField = document.getElementById("customerName");
  const customerPhoneField = document.getElementById("customerPhone");
  const tableField = document.getElementById("tableNumber");
  const notesField = document.getElementById("specialNotes");

  const now = new Date().toISOString();
  const items = Array.from(cart.entries()).map(([name, item]) => ({
    name,
    price: item.price,
    quantity: item.quantity,
    lineTotal: item.price * item.quantity
  }));

  return {
    id: generateOrderId(),
    createdAt: now,
    updatedAt: now,
    status: "Placed",
    customer: {
      name: customerNameField instanceof HTMLInputElement ? customerNameField.value.trim() : "Customer",
      phone: customerPhoneField instanceof HTMLInputElement ? customerPhoneField.value.trim() : "",
      serviceType: getOrderType(),
      tableOrSlot: tableField instanceof HTMLInputElement ? tableField.value.trim() : "",
      address: deliveryAddress?.value.trim() || "",
      paymentMethod: getPaymentMethod(),
      notes: notesField instanceof HTMLTextAreaElement ? notesField.value.trim() : ""
    },
    items,
    totals: billing,
    audit: [
      {
        at: now,
        action: "created",
        by: "customer",
        note: "Order submitted from website checkout"
      }
    ]
  };
}

if (mobileNavToggle && primaryNav) {
  mobileNavToggle.addEventListener("click", () => {
    const isOpen = primaryNav.classList.toggle("is-open");
    mobileNavToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (!primaryNav.contains(target) && !mobileNavToggle.contains(target)) {
      primaryNav.classList.remove("is-open");
      mobileNavToggle.setAttribute("aria-expanded", "false");
    }
  });
}

if (prevBtn) {
  prevBtn.addEventListener("click", () => {
    currentIndex -= 1;
    syncCarousel();
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    currentIndex += 1;
    syncCarousel();
  });
}

if (heroSliderPrev) {
  heroSliderPrev.addEventListener("click", () => {
    updateHeroSlide(heroSlideIndex - 1);
    startHeroSlider();
  });
}

if (heroSliderNext) {
  heroSliderNext.addEventListener("click", () => {
    updateHeroSlide(heroSlideIndex + 1);
    startHeroSlider();
  });
}

heroSliderDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    const slideIndex = Number.parseInt(dot.dataset.slideIndex || "", 10);

    if (Number.isNaN(slideIndex)) {
      return;
    }

    updateHeroSlide(slideIndex);
    startHeroSlider();
  });
});

if (heroSliderDotsWrap) {
  heroSliderDotsWrap.addEventListener("mouseenter", stopHeroSlider);
  heroSliderDotsWrap.addEventListener("mouseleave", startHeroSlider);
}

if (heroPlateCard) {
  heroPlateCard.addEventListener("mouseenter", stopHeroSlider);
  heroPlateCard.addEventListener("mouseleave", startHeroSlider);
}

window.addEventListener("resize", syncCarousel);

dishCards.forEach((card, index) => {
  card.style.setProperty("--stagger-delay", `${index * 90}ms`);
});

window.requestAnimationFrame(() => {
  loadRevealElements.forEach((element) => {
    element.classList.add("is-visible");
  });
});

if ("IntersectionObserver" in window) {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const revealThreshold = window.matchMedia("(max-width: 920px)").matches ? 0.01 : 0.16;
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: revealThreshold, rootMargin: "0px 0px -8% 0px" }
  );

  scrollRevealElements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const startsInViewport = rect.top <= viewportHeight * 0.96 && rect.bottom >= 0;

    if (startsInViewport) {
      element.classList.add("is-visible");
      return;
    }

    revealObserver.observe(element);
  });
} else {
  scrollRevealElements.forEach((element) => {
    element.classList.add("is-visible");
  });
}

gotoMenuLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (primaryNav?.classList.contains("is-open") && mobileNavToggle) {
      primaryNav.classList.remove("is-open");
      mobileNavToggle.setAttribute("aria-expanded", "false");
    }
  });
});

document.querySelectorAll(".top-actions a").forEach((link) => {
  link.addEventListener("click", () => {
    if (primaryNav?.classList.contains("is-open") && mobileNavToggle) {
      primaryNav.classList.remove("is-open");
      mobileNavToggle.setAttribute("aria-expanded", "false");
    }
  });
});

addItemButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.item;
    const price = Number.parseFloat(button.dataset.price || "0");

    if (!name || Number.isNaN(price) || price <= 0) {
      return;
    }

    addItemToCart(name, price);
    setMessage(`${name} added to cart. You can keep adding items or complete checkout.`, "success");
    showToast(`${name} added to cart`);
  });
});

if (cartItemsElement) {
  cartItemsElement.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const name = target.dataset.item;
    const action = target.dataset.action;

    if (!name || !action) {
      return;
    }

    updateItemQuantity(name, action);
  });
}

if (serviceType) {
  serviceType.addEventListener("change", () => {
    setDeliveryRequirement();
    updateTotals();
  });
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (cart.size === 0) {
      setMessage("Your cart is empty. Please add dishes or drinks before checkout.", "error");
      showToast("Your cart is empty", "error");
      document.getElementById("fullMenu")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (!checkoutForm.checkValidity()) {
      checkoutForm.reportValidity();
      return;
    }

    if (getOrderType() === "Delivery" && !deliveryAddress?.value.trim()) {
      setMessage("Delivery address is required for delivery orders.", "error");
      showToast("Delivery address is required", "error");
      deliveryAddress?.focus();
      return;
    }

    const orderPayload = buildOrderPayload();

    if (orderStore) {
      orderStore.addOrder(orderPayload);
    }

    const itemCount = orderPayload.items.reduce((acc, item) => acc + item.quantity, 0);

    setMessage(
      `Order confirmed for ${orderPayload.customer.name}. Order ID: ${orderPayload.id}. Items: ${itemCount}. Total: ${formatCurrency(
        orderPayload.totals.total
      )}. Admin can manage this in admin panel.`,
      "success"
    );
    showToast(`Order ${orderPayload.id} confirmed`);

    cart.clear();
    renderCart();
    checkoutForm.reset();
    setDeliveryRequirement();
  });
}

const globalImageFallback =
  "https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=1200";

document.querySelectorAll("img").forEach((image) => {
  image.addEventListener("error", () => {
    if (image.dataset.fallbackApplied === "true") {
      return;
    }

    image.dataset.fallbackApplied = "true";
    image.src = globalImageFallback;
  });
});

setDeliveryRequirement();
renderCart();
syncCarousel();
updateHeroSlide(0);
startHeroSlider();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopHeroSlider();
    return;
  }

  startHeroSlider();
});
