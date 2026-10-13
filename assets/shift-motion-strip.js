if (!customElements.get('shift-motion-strip')) {
  customElements.define(
    'shift-motion-strip',
    class ShiftMotionStrip extends HTMLElement {
      connectedCallback() {
        if (this.initialized) return;
        this.initialized = true;
        this.control = this.querySelector('[data-shift-strip-control]');
        this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (!this.control) return;

        this.control.addEventListener('click', () => {
          this.userPaused = !this.userPaused;
          this.focusPaused = false;
          this.update();
        });
        this.control.addEventListener('focus', () => {
          this.focusPaused = true;
          this.update();
        });
        this.control.addEventListener('blur', () => {
          this.focusPaused = false;
          this.update();
        });
        this.motionPreference.addEventListener('change', () => this.update());
        this.update();
      }

      update() {
        const paused = this.userPaused || this.focusPaused || this.motionPreference.matches;
        this.classList.toggle('is-paused', paused);
        this.control.setAttribute('aria-pressed', String(Boolean(this.userPaused)));
        this.control.setAttribute('aria-label', this.userPaused ? 'Resume scrolling keywords' : 'Pause scrolling keywords');
      }
    }
  );
}
