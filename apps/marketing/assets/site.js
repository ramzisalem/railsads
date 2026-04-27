// RailsAds — marketing site interactivity.
// Pure vanilla JS, no dependencies. Keeps the site fast and SEO-friendly.

(function () {
  "use strict";

  /* ---------- Theme (light / dark) ----------------------------------- */
  const root = document.documentElement;
  const STORAGE_KEY = "railsads.theme";

  function applyTheme(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function readStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function storeTheme(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {
      /* ignore */
    }
  }

  // Resolve initial theme: stored preference > system preference > light.
  const stored = readStoredTheme();
  if (stored === "dark" || stored === "light") {
    applyTheme(stored);
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    applyTheme("dark");
  }

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const isDark = root.getAttribute("data-theme") === "dark";
      const next = isDark ? "light" : "dark";
      applyTheme(next);
      storeTheme(next);
    });
  });

  // Live-react to system theme changes when no explicit preference is stored.
  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      if (!readStoredTheme()) applyTheme(e.matches ? "dark" : "light");
    };
    if (media.addEventListener) media.addEventListener("change", onChange);
    else if (media.addListener) media.addListener(onChange);
  }

  /* ---------- Header scroll state ------------------------------------ */
  const header = document.querySelector(".site-header");
  if (header) {
    const updateScrolled = () => {
      header.dataset.scrolled = window.scrollY > 4 ? "true" : "false";
    };
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
  }

  /* ---------- Mobile menu -------------------------------------------- */
  const menuButton = document.querySelector("[data-menu-button]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");
  if (menuButton && mobileMenu) {
    const closeMenu = () => {
      mobileMenu.dataset.open = "false";
      menuButton.setAttribute("aria-expanded", "false");
    };
    const openMenu = () => {
      mobileMenu.dataset.open = "true";
      menuButton.setAttribute("aria-expanded", "true");
    };

    menuButton.addEventListener("click", () => {
      const open = mobileMenu.dataset.open === "true";
      open ? closeMenu() : openMenu();
    });

    mobileMenu.addEventListener("click", (e) => {
      if (e.target instanceof HTMLAnchorElement) closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768) closeMenu();
    });
  }

  /* ---------- Reveal-on-scroll --------------------------------------- */
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const revealTargets = document.querySelectorAll(".reveal");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.dataset.revealed = "true";
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => (el.dataset.revealed = "true"));
  }

  /* ---------- Animated counters -------------------------------------- */
  const counters = document.querySelectorAll("[data-counter]");
  if (counters.length) {
    const formatNumber = (n) => {
      // Keep it crisp — no thousands separator for small ints.
      return Math.round(n).toString();
    };
    const animateCounter = (el) => {
      // Override option for non-numeric (e.g. "∞")
      const overrideText = el.getAttribute("data-target-text");
      if (overrideText) {
        el.textContent = overrideText;
        return;
      }
      const target = Number(el.getAttribute("data-target") || "0");
      if (!Number.isFinite(target)) {
        el.textContent = el.getAttribute("data-target") || "";
        return;
      }
      if (reduceMotion) {
        el.textContent = formatNumber(target);
        return;
      }
      const duration = 1400;
      const start = performance.now();
      const easeOut = (t) => 1 - Math.pow(1 - t, 3);
      const tick = (now) => {
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / duration);
        el.textContent = formatNumber(target * easeOut(progress));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if ("IntersectionObserver" in window) {
      const cio = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animateCounter(entry.target);
              cio.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.4 }
      );
      counters.forEach((el) => cio.observe(el));
    } else {
      counters.forEach(animateCounter);
    }
  }

  /* ---------- Subtle parallax on hero floating cards ----------------- */
  const floatCards = document.querySelectorAll(".float-card");
  if (floatCards.length && !reduceMotion) {
    let raf = null;
    const updateParallax = () => {
      const scrolled = window.scrollY;
      floatCards.forEach((card, i) => {
        const speed = (i % 2 === 0 ? 0.05 : -0.04) * (1 + (i % 3) * 0.2);
        card.style.setProperty("--p", `${scrolled * speed}px`);
        card.style.translate = `0 ${scrolled * speed}px`;
      });
      raf = null;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (raf == null) raf = requestAnimationFrame(updateParallax);
      },
      { passive: true }
    );
  }

  /* ---------- Smooth-scroll for in-page anchors ---------------------- */
  document.addEventListener("click", (e) => {
    const link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute("href");
    if (!id || id === "#") return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    if (history.pushState) history.pushState(null, "", id);
  });

  /* ---------- Footer year -------------------------------------------- */
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear().toString();
})();
