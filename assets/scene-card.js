(() => {
  const SELECTOR = '[data-section-type="scene-card"]';
  const instances = new Map();

  class SceneCard {
    constructor(section) {
      this.section = section;
      this.id = section.dataset.sectionId;
      this.items = Array.from(section.querySelectorAll('.scene-card__item'));
      this.total = this.items.length;
      this.activeIndex = 0;
      this.isActive = false;
      this.lastAction = 0;
      this.throttleMs = Number(section.dataset.throttle || 900);
      this.touchStartY = 0;
      this.touchLastY = 0;

      this.onWheel = this.onWheel.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);

      this.initObserver();
      this.update();
    }

    initObserver() {
      if (!('IntersectionObserver' in window)) {
        this.activate();
        return;
      }

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target !== this.section) return;
            if (entry.isIntersecting) {
              this.activate();
            } else {
              this.deactivate();
            }
          });
        },
        { threshold: 0.6 }
      );

      this.observer.observe(this.section);
    }

    activate() {
      if (this.isActive) return;
      this.isActive = true;
      this.section.classList.add('is-active');
      this.section.addEventListener('wheel', this.onWheel, { passive: false });
      this.section.addEventListener('touchstart', this.onTouchStart, { passive: true });
      this.section.addEventListener('touchmove', this.onTouchMove, { passive: false });
      this.section.addEventListener('touchend', this.onTouchEnd, { passive: true });
    }

    deactivate() {
      if (!this.isActive) return;
      this.isActive = false;
      this.section.classList.remove('is-active');
      this.section.removeEventListener('wheel', this.onWheel);
      this.section.removeEventListener('touchstart', this.onTouchStart);
      this.section.removeEventListener('touchmove', this.onTouchMove);
      this.section.removeEventListener('touchend', this.onTouchEnd);
    }

    isBoundary(direction) {
      return (
        (direction > 0 && this.activeIndex >= this.total - 1) ||
        (direction < 0 && this.activeIndex <= 0)
      );
    }

    canNavigate() {
      const now = Date.now();
      if (now - this.lastAction < this.throttleMs) return false;
      this.lastAction = now;
      return true;
    }

    onWheel(event) {
      if (!this.isActive || this.total < 2) return;
      const deltaY = event.deltaY;
      if (Math.abs(deltaY) < 4) return;
      const direction = deltaY > 0 ? 1 : -1;

      if (this.isBoundary(direction)) return;

      event.preventDefault();
      if (!this.canNavigate()) return;
      this.navigate(direction);
    }

    onTouchStart(event) {
      if (!this.isActive) return;
      this.touchStartY = event.touches[0].clientY;
      this.touchLastY = this.touchStartY;
    }

    onTouchMove(event) {
      if (!this.isActive || this.total < 2) return;
      this.touchLastY = event.touches[0].clientY;
      const delta = this.touchStartY - this.touchLastY;
      if (Math.abs(delta) < 4) return;
      const direction = delta > 0 ? 1 : -1;
      if (!this.isBoundary(direction)) {
        event.preventDefault();
      }
    }

    onTouchEnd() {
      if (!this.isActive || this.total < 2) return;
      const delta = this.touchStartY - this.touchLastY;
      if (Math.abs(delta) < 40) return;
      const direction = delta > 0 ? 1 : -1;
      if (this.isBoundary(direction)) return;
      if (!this.canNavigate()) return;
      this.navigate(direction);
    }

    navigate(direction) {
      const nextIndex = Math.max(0, Math.min(this.total - 1, this.activeIndex + direction));
      if (nextIndex === this.activeIndex) return;
      this.activeIndex = nextIndex;
      this.update();
    }

    update() {
      this.items.forEach((item, index) => {
        const isActive = index === this.activeIndex;
        item.classList.toggle('is-active', isActive);
        item.classList.toggle('is-prev', index === this.activeIndex - 1);
        item.classList.toggle('is-next', index === this.activeIndex + 1);
        item.classList.toggle('is-before', index < this.activeIndex - 1);
        item.classList.toggle('is-after', index > this.activeIndex + 1);
        item.setAttribute('aria-hidden', isActive ? 'false' : 'true');

        const link = item.querySelector('.scene-card__link');
        if (link) {
          if (isActive) {
            link.removeAttribute('tabindex');
          } else {
            link.setAttribute('tabindex', '-1');
          }
        }
      });
    }

    destroy() {
      this.deactivate();
      if (this.observer) this.observer.disconnect();
    }
  }

  const initSection = (section) => {
    if (!section || instances.has(section)) return;
    const instance = new SceneCard(section);
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
    const section = document.querySelector(
      `${SELECTOR}[data-section-id="${event.detail.sectionId}"]`
    );
    if (!section) return;
    const instance = instances.get(section);
    if (instance) instance.destroy();
    instances.delete(section);
  });
})();
