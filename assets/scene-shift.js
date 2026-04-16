(() => {
  const SELECTOR = '[data-section-type="scene-shift"]';
  const instances = new Map();

  class SceneShift {
    constructor(section) {
      this.section = section;
      this.id = section.dataset.sectionId;
      this.slides = Array.from(section.querySelectorAll('.scene-shift__slide'));
      this.dots = Array.from(section.querySelectorAll('.scene-shift__dot'));
      this.prevBtn = section.querySelector('.scene-shift__nav--prev');
      this.nextBtn = section.querySelector('.scene-shift__nav--next');
      this.total = this.slides.length;
      this.activeIndex = 0;
      this.autoplay = section.dataset.autoplay === 'true';
      this.intervalMs = Number(section.dataset.interval || 8000);
      this.pauseMs = Number(section.dataset.pause || 2000);
      this.breatheMs = Number(section.dataset.breathe || 4000);
      this.autoplayTimer = null;
      this.breatheTimer = null;
      this.isVisible = false;
      this.isPaused = false;
      this.isEstablished = false; /* Set true after scroll-drawer rise completes */

      section.style.setProperty('--scene-shift-breathe-ms', this.breatheMs + 'ms');

      this.onPrev = this.onPrev.bind(this);
      this.onNext = this.onNext.bind(this);
      this.onDotClick = this.onDotClick.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      this.onEstablished = this.onEstablished.bind(this);
      this.onRetracted = this.onRetracted.bind(this);

      this.bindEvents();
      this.initObserver();
      this.goTo(0, true); /* true = suppress breathing on init */
    }

    bindEvents() {
      if (this.prevBtn) this.prevBtn.addEventListener('click', this.onPrev);
      if (this.nextBtn) this.nextBtn.addEventListener('click', this.onNext);

      this.dots.forEach((dot, i) => {
        dot.addEventListener('click', () => this.onDotClick(i));
      });

      document.addEventListener('visibilitychange', this.onVisibilityChange);

      /* Listen for scroll choreography events */
      this.section.addEventListener('scene-shift:established', this.onEstablished);
      this.section.addEventListener('scene-shift:retracted', this.onRetracted);

      /* Pause autoplay on hover/focus */
      this.section.addEventListener('mouseenter', () => { this.isPaused = true; this.stopAutoplay(); });
      this.section.addEventListener('mouseleave', () => { this.isPaused = false; if (this.isVisible) this.startAutoplay(); });
      this.section.addEventListener('focusin', () => { this.isPaused = true; this.stopAutoplay(); });
      this.section.addEventListener('focusout', (e) => {
        if (!this.section.contains(e.relatedTarget)) {
          this.isPaused = false;
          if (this.isVisible) this.startAutoplay();
        }
      });
    }

    initObserver() {
      if (!('IntersectionObserver' in window)) {
        this.isVisible = true;
        this.startAutoplay();
        return;
      }

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target !== this.section) return;
            this.isVisible = entry.isIntersecting;
            if (this.isVisible && !this.isPaused && this.isEstablished) {
              this.startAutoplay();
            } else {
              this.stopAutoplay();
            }
          });
        },
        { threshold: 0.3 }
      );

      this.observer.observe(this.section);
    }

    onVisibilityChange() {
      if (document.hidden) {
        this.stopAutoplay();
      } else if (this.isVisible && !this.isPaused && this.isEstablished) {
        this.startAutoplay();
      }
    }

    onPrev() {
      const prev = (this.activeIndex - 1 + this.total) % this.total;
      this.goTo(prev);
      this.restartAutoplay();
    }

    onNext() {
      const next = (this.activeIndex + 1) % this.total;
      this.goTo(next);
      this.restartAutoplay();
    }

    onDotClick(index) {
      if (index === this.activeIndex) return;
      this.goTo(index);
      this.restartAutoplay();
    }

    onEstablished() {
      this.isEstablished = true;
      /* Now trigger first breathing + autoplay */
      this.scheduleBreathe();
      if (!this.isPaused) this.startAutoplay();
    }

    onRetracted() {
      this.isEstablished = false;
      this.clearBreathe();
      this.stopAutoplay();
    }

    goTo(index, suppressBreathe) {
      if (index < 0 || index >= this.total) return;

      /* Cancel pending breathe timer */
      if (this.breatheTimer) {
        clearTimeout(this.breatheTimer);
        this.breatheTimer = null;
      }

      const transitionMs = parseInt(
        getComputedStyle(this.section).getPropertyValue('--scene-shift-transition-ms') || '800', 10
      );

      this.activeIndex = index;

      /* Update slides */
      this.slides.forEach((slide, i) => {
        const isActive = i === index;
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');

        /* Clean up breathing on inactive slides AFTER the slide fade-out completes */
        if (!isActive) {
          setTimeout(() => {
            slide.querySelectorAll('.scene-shift__layer--shift.is-breathing').forEach((layer) => {
              layer.classList.remove('is-breathing');
            });
          }, transitionMs + 50);
        }
      });

      /* Update dots */
      this.dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });

      /* Nav buttons always enabled for looping */
      if (this.prevBtn) this.prevBtn.disabled = false;
      if (this.nextBtn) this.nextBtn.disabled = false;

      /* Start breathing cycle only if panel is established */
      if (!suppressBreathe && this.isEstablished) {
        this.scheduleBreathe();
      }
    }

    scheduleBreathe() {
      /* Only cancel pending timer — don't strip classes globally,
         old slides clean up via delayed timeout in goTo() */
      if (this.breatheTimer) {
        clearTimeout(this.breatheTimer);
        this.breatheTimer = null;
      }

      const activeSlide = this.slides[this.activeIndex];
      if (!activeSlide) return;

      const shiftLayers = activeSlide.querySelectorAll('.scene-shift__layer--shift');
      if (shiftLayers.length === 0) return;

      /* Ensure the new active card starts clean (no leftover breathing) */
      shiftLayers.forEach((layer) => {
        layer.classList.remove('is-breathing');
      });

      /* After initial pause, trigger breathing animation */
      this.breatheTimer = setTimeout(() => {
        shiftLayers.forEach((layer) => {
          void layer.offsetWidth;
          layer.classList.add('is-breathing');
        });
      }, this.pauseMs);
    }

    clearBreathe() {
      if (this.breatheTimer) {
        clearTimeout(this.breatheTimer);
        this.breatheTimer = null;
      }

      /* Remove breathing class from all shift layers */
      this.section.querySelectorAll('.scene-shift__layer--shift.is-breathing').forEach((layer) => {
        layer.classList.remove('is-breathing');
      });
    }

    startAutoplay() {
      if (!this.autoplay || this.total < 2) return;
      this.stopAutoplay();

      /* Wait for: pause before breathe + breathe cycle + 500ms dwell */
      const delay = this.pauseMs + this.breatheMs + 500;

      this.autoplayTimer = setTimeout(() => {
        const next = (this.activeIndex + 1) % this.total;
        this.goTo(next);
        this.startAutoplay();
      }, delay);
    }

    stopAutoplay() {
      if (this.autoplayTimer) {
        clearTimeout(this.autoplayTimer);
        this.autoplayTimer = null;
      }
    }

    restartAutoplay() {
      this.stopAutoplay();
      if (this.isVisible && !this.isPaused && this.isEstablished) {
        this.startAutoplay();
      }
    }

    destroy() {
      this.stopAutoplay();
      this.clearBreathe();
      if (this.observer) this.observer.disconnect();
      if (this.prevBtn) this.prevBtn.removeEventListener('click', this.onPrev);
      if (this.nextBtn) this.nextBtn.removeEventListener('click', this.onNext);
      this.section.removeEventListener('scene-shift:established', this.onEstablished);
      this.section.removeEventListener('scene-shift:retracted', this.onRetracted);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  const initSection = (section) => {
    if (!section || instances.has(section)) return;
    const instance = new SceneShift(section);
    instances.set(section, instance);
  };

  const initAll = (root = document) => {
    root.querySelectorAll(SELECTOR).forEach(initSection);
  };

  document.addEventListener('DOMContentLoaded', () => initAll());

  document.addEventListener('shopify:section:load', (event) => {
    initAll(event.target);
  });

  document.addEventListener('shopify:section:unload', (event) => {
    const section = event.target.querySelector(SELECTOR);
    if (!section) return;
    const instance = instances.get(section);
    if (instance) instance.destroy();
    instances.delete(section);
  });

  /* Re-init on Shopify block add/remove/select */
  document.addEventListener('shopify:block:select', (event) => {
    const section = event.target.closest(SELECTOR);
    if (!section) return;
    const instance = instances.get(section);
    if (!instance) return;
    const blockId = event.target.dataset.blockId;
    const index = instance.slides.findIndex((s) => s.dataset.blockId === blockId);
    if (index >= 0) {
      instance.stopAutoplay();
      instance.goTo(index);
    }
  });

  document.addEventListener('shopify:block:deselect', (event) => {
    const section = event.target.closest(SELECTOR);
    if (!section) return;
    const instance = instances.get(section);
    if (instance && instance.isVisible) instance.startAutoplay();
  });
})();
