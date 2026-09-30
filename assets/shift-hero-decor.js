if (!customElements.get('shift-hero-decor')) {
  customElements.define(
    'shift-hero-decor',
    class ShiftHeroDecor extends HTMLElement {
      connectedCallback() {
        if (this.initialized) return;
        this.initialized = true;
        this.section = this.closest('.shift-section--hero');
        this.isIntersecting = true;

        this.visibilityHandler = () => this.update();
        document.addEventListener('visibilitychange', this.visibilityHandler);

        if ('IntersectionObserver' in window && this.section) {
          this.observer = new IntersectionObserver(([entry]) => {
            this.isIntersecting = entry.isIntersecting;
            this.update();
          });
          this.observer.observe(this.section);
        }

        this.update();
      }

      disconnectedCallback() {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        this.observer?.disconnect();
      }

      update() {
        this.classList.toggle('is-motion-paused', document.hidden || !this.isIntersecting);
      }
    }
  );
}
