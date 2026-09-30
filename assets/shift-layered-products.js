if (!customElements.get('shift-layered-products')) {
  customElements.define(
    'shift-layered-products',
    class ShiftLayeredProducts extends HTMLElement {
      async connectedCallback() {
        this.objects = [...this.querySelectorAll('[data-layered-object]')];
        this.scene = this.querySelector('.shift-layered__scene');
        if (!this.objects.length) return;

        this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.frame = null;
        this.update = this.update.bind(this);
        this.requestUpdate = this.requestUpdate.bind(this);

        if (this.reduceMotion.matches) {
          this.showFinalState();
          return;
        }

        await this.prepareImages();
        if (!this.isConnected || this.reduceMotion.matches) {
          this.showFinalState();
          return;
        }

        const initialProgress = this.getSceneProgress();
        if (initialProgress >= 0.9) {
          this.showFinalState();
          return;
        }

        this.applyProgress(initialProgress);
        this.classList.add('is-enhanced');
        window.addEventListener('scroll', this.requestUpdate, { passive: true });
        window.addEventListener('resize', this.requestUpdate, { passive: true });
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
        const overall = this.getSceneProgress();
        this.applyProgress(overall);

        if (overall >= 1) this.classList.add('is-settled');
        else this.classList.remove('is-settled');
      }

      getSceneProgress() {
        const rect = this.scene.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const start = viewportHeight * 0.82;
        const end = viewportHeight * 0.38;
        return Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      }

      applyProgress(overall) {
        const ranges = [
          [0.05, 0.4],
          [0.25, 0.65],
          [0.5, 0.9],
        ];
        const desktopMotion = [
          { x: -48, y: 36, angle: -1.8 },
          { x: 0, y: 52, angle: 1.3 },
          { x: 48, y: 34, angle: -1.2 },
        ];
        const mobileMotion = [
          { x: -24, y: 22, angle: 0 },
          { x: 0, y: 28, angle: 0 },
          { x: 24, y: 22, angle: 0 },
        ];
        const motion = window.matchMedia('(max-width: 749px)').matches ? mobileMotion : desktopMotion;

        this.objects.forEach((object, index) => {
          const [start, end] = ranges[index];
          const linear = Math.min(1, Math.max(0, (overall - start) / (end - start)));
          const progress = 1 - Math.pow(1 - linear, 3);
          const remaining = 1 - progress;
          object.style.setProperty('--shift-layer-progress', progress.toFixed(3));
          object.style.setProperty('--shift-layer-offset-x', `${(remaining * motion[index].x).toFixed(2)}px`);
          object.style.setProperty('--shift-layer-offset-y', `${(remaining * motion[index].y).toFixed(2)}px`);
          object.style.setProperty('--shift-layer-angle', `${(remaining * motion[index].angle).toFixed(3)}deg`);
        });
      }

      prepareImages() {
        const images = [...this.scene.querySelectorAll('img')];
        return Promise.allSettled(
          images.map((image) => {
            if (image.complete && image.naturalWidth > 0) return Promise.resolve();
            if (typeof image.decode === 'function') return image.decode();
            return new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          })
        );
      }

      showFinalState() {
        this.classList.remove('is-enhanced');
        this.objects.forEach((object) => {
          object.style.setProperty('--shift-layer-progress', '1');
          object.style.setProperty('--shift-layer-offset-x', '0px');
          object.style.setProperty('--shift-layer-offset-y', '0px');
          object.style.setProperty('--shift-layer-angle', '0deg');
        });
      }
    }
  );
}
