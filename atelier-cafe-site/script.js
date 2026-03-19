// Mobile navigation + subtle section reveal interactions.
const navToggle = document.getElementById("navToggle");
const siteNav = document.getElementById("siteNav");
const navLinks = [...siteNav.querySelectorAll("a")];
const reveals = [...document.querySelectorAll(".reveal")];
const yearEl = document.getElementById("year");
const header = document.querySelector(".site-header");
const sectionLinks = navLinks.filter((link) => {
  const href = link.getAttribute("href");
  return href && href.startsWith("#");
});

function setYear() {
  yearEl.textContent = String(new Date().getFullYear());
}

function closeNav() {
  siteNav.classList.remove("is-open");
  navToggle.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
}

function toggleNav() {
  const isOpen = siteNav.classList.toggle("is-open");
  navToggle.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
}

function bindNavigation() {
  navToggle.addEventListener("click", toggleNav);

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      // Close drawer after selecting a section on mobile.
      closeNav();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNav();
    }
  });
}

function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  reveals.forEach((section) => observer.observe(section));
}

function bindActiveNav() {
  const targets = sectionLinks
    .map((link) => {
      const selector = link.getAttribute("href");
      const section = selector ? document.querySelector(selector) : null;
      if (!section) {
        return null;
      }
      return { link, section };
    })
    .filter(Boolean);

  if (!targets.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        targets.forEach((item) => item.link.classList.remove("is-active"));
        const match = targets.find((item) => item.section === entry.target);
        if (match) {
          match.link.classList.add("is-active");
        }
      });
    },
    {
      threshold: 0.45
    }
  );

  targets.forEach((item) => observer.observe(item.section));
}

function bindHeaderState() {
  const updateHeader = () => {
    if (window.scrollY > 4) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

function init() {
  setYear();
  bindNavigation();
  initReveal();
  bindActiveNav();
  bindHeaderState();
}

init();
