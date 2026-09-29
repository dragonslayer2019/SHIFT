if (!customElements.get('shift-community-carousel')) {
  customElements.define(
    'shift-community-carousel',
    class ShiftCommunityCarousel extends HTMLElement {
      connectedCallback() {
        this.slides = Array.from(this.querySelectorAll('[data-carousel-slide]'));
        this.previousButton = this.querySelector('[data-carousel-previous]');
        this.nextButton = this.querySelector('[data-carousel-next]');
        this.currentOutput = this.querySelector('[data-carousel-current]');
        this.viewport = this.querySelector('[data-carousel-viewport]');
        this.currentIndex = Math.max(0, this.slides.findIndex((slide) => slide.classList.contains('is-active')));

        if (this.slides.length < 2 || !this.viewport) return;

        this.previousButton?.addEventListener('click', () => this.show(this.currentIndex - 1));
        this.nextButton?.addEventListener('click', () => this.show(this.currentIndex + 1));
        this.viewport.addEventListener('keydown', (event) => this.onKeydown(event));
        this.viewport.addEventListener('touchstart', (event) => this.onTouchStart(event), { passive: true });
        this.viewport.addEventListener('touchend', (event) => this.onTouchEnd(event), { passive: true });

        if (window.Shopify?.designMode) {
          this.addEventListener('shopify:block:select', (event) => {
            const selectedSlide = event.target.closest('[data-carousel-slide]');
            if (selectedSlide) this.show(this.slides.indexOf(selectedSlide), false);
          });
        }

        this.show(this.currentIndex, false);
      }

      show(index, announce = true) {
        const nextIndex = (index + this.slides.length) % this.slides.length;

        this.slides.forEach((slide, slideIndex) => {
          const isActive = slideIndex === nextIndex;
          slide.classList.toggle('is-active', isActive);
          slide.setAttribute('aria-hidden', String(!isActive));
          slide.inert = !isActive;
        });

        this.currentIndex = nextIndex;
        if (this.currentOutput) {
          this.currentOutput.textContent = String(nextIndex + 1);
          if (!announce) this.currentOutput.closest('[aria-live]')?.setAttribute('aria-live', 'off');
          requestAnimationFrame(() => this.currentOutput.closest('[aria-live]')?.setAttribute('aria-live', 'polite'));
        }
      }

      onKeydown(event) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this.show(this.currentIndex - 1);
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          this.show(this.currentIndex + 1);
        }
      }

      onTouchStart(event) {
        const touch = event.changedTouches[0];
        this.touchStart = { x: touch.clientX, y: touch.clientY };
      }

      onTouchEnd(event) {
        if (!this.touchStart) return;

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - this.touchStart.x;
        const deltaY = touch.clientY - this.touchStart.y;
        this.touchStart = null;

        if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
        this.show(this.currentIndex + (deltaX < 0 ? 1 : -1));
      }
    }
  );
}
