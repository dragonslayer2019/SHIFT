if (!customElements.get('shift-layered-products')) {
  customElements.define(
    'shift-layered-products',
    class ShiftLayeredProducts extends HTMLElement {
      connectedCallback() {
        this.objects = [...this.querySelectorAll('[data-layered-object]')];
        if (!this.objects.length) return;

        this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.frame = null;
        this.update = this.update.bind(this);
        this.requestUpdate = this.requestUpdate.bind(this);

        if (this.reduceMotion.matches) {
          this.showFinalState();
          return;
        }

        this.classList.add('is-enhanced');
        window.addEventListener('scroll', this.requestUpdate, { passive: true });
        window.addEventListener('resize', this.requestUpdate, { passive: true });
        this.requestUpdate();
      }

      disconnectedCallback() {
        window.removeEventListener('scroll', this.requestUpdate);
        window.removeEventListener('resize', this.requestUpdate);
        if (this.frame) cancelAnimationFrame(this.frame);
      }

      requestUpdate() {
        if (this.frame) return;
        this.frame = requestAnimationFrame(this.update);
      }

      update() {
        this.frame = null;
        const rect = this.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const start = viewportHeight * 0.9;
        const distance = Math.max(viewportHeight * 0.38, 260);
        const overall = Math.min(1, Math.max(0, (start - rect.top) / distance));

        this.objects.forEach((object, index) => {
          const delay = index * 0.12;
          const progress = Math.min(1, Math.max(0, (overall - delay) / (1 - delay)));
          const rotations = [-1.5, 1.2, -1];
          object.style.setProperty('--shift-layer-progress', progress.toFixed(3));
          object.style.setProperty('--shift-layer-offset', `${((1 - progress) * 2.2).toFixed(3)}rem`);
          object.style.setProperty('--shift-layer-angle', `${((1 - progress) * rotations[index]).toFixed(3)}deg`);
        });

        if (overall >= 1) this.classList.add('is-settled');
      }

      showFinalState() {
        this.classList.remove('is-enhanced');
        this.objects.forEach((object) => {
          object.style.setProperty('--shift-layer-progress', '1');
          object.style.setProperty('--shift-layer-offset', '0rem');
          object.style.setProperty('--shift-layer-angle', '0deg');
        });
      }
    }
  );
}
