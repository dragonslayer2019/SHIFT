(() => {
  if (window.shiftHomeMotionInitialized) return;
  window.shiftHomeMotionInitialized = true;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  function initialize(root = document) {
    const elements = Array.from(root.querySelectorAll('[data-shift-reveal]:not(.is-shift-revealed)'));
    if (elements.length === 0) return;

    if (motionPreference.matches || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-shift-revealed'));
      return;
    }

    document.documentElement.classList.add('shift-motion-enhanced');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-shift-revealed');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px 10% 0px', threshold: 0.04 }
    );
    elements.forEach((element) => observer.observe(element));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initialize(), { once: true });
  } else {
    initialize();
  }

  document.addEventListener('shopify:section:load', (event) => initialize(event.target));
})();
