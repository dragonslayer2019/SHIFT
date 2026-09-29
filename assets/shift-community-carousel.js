if (!customElements.get('shift-community-carousel')) {
  customElements.define(
    'shift-community-carousel',
    class ShiftCommunityCarousel extends HTMLElement {
      static autoplayDuration = 6000;

      connectedCallback() {
        if (this.initialized) return;
        this.initialized = true;

        this.slides = Array.from(this.querySelectorAll('[data-carousel-slide]'));
        this.dots = Array.from(this.querySelectorAll('[data-carousel-dot]'));
        this.status = this.querySelector('[data-carousel-status]');
        this.viewport = this.querySelector('[data-carousel-viewport]');
        this.currentIndex = Math.max(0, this.slides.findIndex((slide) => slide.classList.contains('is-active')));
        this.elapsed = 0;
        this.lastTimestamp = null;
        this.pauseReasons = new Set();
        this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

        if (this.slides.length < 2 || !this.viewport) return;

        this.dots.forEach((dot, index) =>
          dot.addEventListener('click', (event) => this.onDotClick(index, event))
        );
        this.viewport.addEventListener('keydown', (event) => this.onKeydown(event));
        this.viewport.addEventListener('touchstart', (event) => this.onTouchStart(event), { passive: true });
        this.viewport.addEventListener('touchend', (event) => this.onTouchEnd(event), { passive: true });
        this.addEventListener('pointerenter', (event) => {
          if (event.pointerType === 'mouse') this.pause('hover');
        });
        this.addEventListener('pointerleave', (event) => {
          if (event.pointerType === 'mouse') this.resume('hover');
        });
        this.addEventListener('focusin', () => this.pause('focus'));
        this.addEventListener('focusout', () => {
          requestAnimationFrame(() => {
            if (!this.contains(document.activeElement)) this.resume('focus');
          });
        });

        this.onVisibilityChange = () => (document.hidden ? this.pause('visibility') : this.resume('visibility'));
        this.onMotionPreferenceChange = (event) => {
          if (event.matches) {
            this.pause('reduced-motion');
            this.setProgress(0);
          } else {
            this.resume('reduced-motion');
          }
          this.updateDotControls();
        };
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        this.motionPreference.addEventListener('change', this.onMotionPreferenceChange);

        if (document.hidden) this.pauseReasons.add('visibility');
        if (this.motionPreference.matches) this.pauseReasons.add('reduced-motion');

        if (window.Shopify?.designMode) {
          this.addEventListener('shopify:block:select', (event) => {
            const selectedSlide = event.target.closest('[data-carousel-slide]');
            if (selectedSlide) this.show(this.slides.indexOf(selectedSlide), false);
          });
        }

        this.show(this.currentIndex, false);
        this.updateDotControls();
        this.startTimer();
      }

      disconnectedCallback() {
        cancelAnimationFrame(this.animationFrame);
        clearTimeout(this.touchResumeTimeout);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.motionPreference?.removeEventListener('change', this.onMotionPreferenceChange);
      }

      show(index, announce = true, resetTimer = true) {
        const nextIndex = (index + this.slides.length) % this.slides.length;

        this.slides.forEach((slide, slideIndex) => {
          const isActive = slideIndex === nextIndex;
          slide.classList.toggle('is-active', isActive);
          slide.setAttribute('aria-hidden', String(!isActive));
          slide.inert = !isActive;
        });

        this.dots.forEach((dot, dotIndex) => {
          if (dotIndex === nextIndex) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
          dot.style.setProperty('--shift-carousel-progress', '0');
        });

        this.currentIndex = nextIndex;
        this.updateDotControls();
        if (this.status) {
          this.status.textContent = `Community note ${nextIndex + 1} of ${this.slides.length}`;
          if (!announce) this.status.setAttribute('aria-live', 'off');
          requestAnimationFrame(() => this.status?.setAttribute('aria-live', 'polite'));
        }

        if (resetTimer) this.resetTimer();
      }

      resetTimer() {
        this.elapsed = 0;
        this.lastTimestamp = null;
        this.setProgress(0);
        this.startTimer();
      }

      startTimer() {
        cancelAnimationFrame(this.animationFrame);
        if (this.pauseReasons.size > 0) return;
        this.animationFrame = requestAnimationFrame((timestamp) => this.tick(timestamp));
      }

      tick(timestamp) {
        if (this.pauseReasons.size > 0) return;

        if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
        else this.elapsed += timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;

        if (this.elapsed >= ShiftCommunityCarousel.autoplayDuration) {
          this.elapsed %= ShiftCommunityCarousel.autoplayDuration;
          this.show(this.currentIndex + 1, true, false);
        }

        this.setProgress(this.elapsed / ShiftCommunityCarousel.autoplayDuration);
        this.animationFrame = requestAnimationFrame((nextTimestamp) => this.tick(nextTimestamp));
      }

      setProgress(progress) {
        const visibleProgress = this.motionPreference?.matches ? 0 : Math.min(1, Math.max(0, progress));
        this.dots[this.currentIndex]?.style.setProperty('--shift-carousel-progress', String(visibleProgress));
      }

      pause(reason) {
        if (this.pauseReasons.has(reason)) return;
        this.pauseReasons.add(reason);
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
        this.lastTimestamp = null;
      }

      resume(reason) {
        if (!this.pauseReasons.delete(reason)) return;
        this.startTimer();
      }

      onDotClick(index, event) {
        if (index === this.currentIndex) {
          this.toggleAutoplay();
          if (event.detail > 0) event.currentTarget.blur();
          return;
        }

        this.show(index);
      }

      toggleAutoplay() {
        if (this.pauseReasons.has('user') || this.pauseReasons.has('reduced-motion')) {
          this.pauseReasons.delete('user');
          this.pauseReasons.delete('reduced-motion');
          this.pauseReasons.delete('hover');
          this.pauseReasons.delete('focus');
          this.startTimer();
        } else {
          this.pause('user');
        }
        this.updateDotControls();
      }

      updateDotControls() {
        const isUserPaused = this.pauseReasons.has('user') || this.pauseReasons.has('reduced-motion');
        this.classList.toggle('is-user-paused', isUserPaused);
        this.dots.forEach((dot, index) => {
          const isCurrent = index === this.currentIndex;
          if (isCurrent) {
            dot.setAttribute('aria-pressed', String(isUserPaused));
            dot.setAttribute(
              'aria-label',
              `${isUserPaused ? 'Resume' : 'Pause'} community notes autoplay; current note ${index + 1} of ${this.slides.length}`
            );
          } else {
            dot.removeAttribute('aria-pressed');
            dot.setAttribute('aria-label', `Show community note ${index + 1} of ${this.slides.length}`);
          }
        });
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
        clearTimeout(this.touchResumeTimeout);
        this.pause('touch');
        const touch = event.changedTouches[0];
        this.touchStart = { x: touch.clientX, y: touch.clientY };
      }

      onTouchEnd(event) {
        if (!this.touchStart) return;

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - this.touchStart.x;
        const deltaY = touch.clientY - this.touchStart.y;
        this.touchStart = null;

        if (Math.abs(deltaX) >= 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
          this.show(this.currentIndex + (deltaX < 0 ? 1 : -1));
        }

        this.touchResumeTimeout = setTimeout(() => this.resume('touch'), 1200);
      }
    }
  );
}
