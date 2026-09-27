/* ═══════════════════════════════════════════════════════════════
   UGC Mood — Carousel + Modal Controller
   ─────────────────────────────────────────────────────────────
   • 3-card carousel with center + side peeks
   • "Read more" opens modal with full review content
   • Touch swipe + keyboard navigation
   ═══════════════════════════════════════════════════════════════ */

(() => {
  const SELECTOR = '[data-section-type="ugc-mood"]';
  const instances = new Map();

  class UgcMood {
    constructor(section) {
      this.section = section;
      this.id = section.dataset.sectionId;
      this.cards = Array.from(section.querySelectorAll('.ugc-mood__card'));
      this.triggers = Array.from(section.querySelectorAll('.ugc-mood__trigger'));
      this.prevBtn = section.querySelector('.ugc-mood__nav--prev');
      this.nextBtn = section.querySelector('.ugc-mood__nav--next');
      this.modals = Array.from(section.querySelectorAll('.ugc-mood__modal'));
      this.total = this.cards.length;
      this.activeIndex = 0;
      this.isAnimating = false;

      // Touch
      this.touchStartX = 0;
      this.touchDeltaX = 0;
      this.swipeThreshold = 50;

      this.bindEvents();
      this.update();
    }

    /* ── Events ── */
    bindEvents() {
      if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.navigate(-1));
      if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.navigate(1));

      this.triggers.forEach((trigger) => {
        trigger.addEventListener('click', () => {
          const idx = parseInt(trigger.dataset.target, 10);
          if (!isNaN(idx)) this.goTo(idx);
        });
      });

      // Touch swipe
      this.section.addEventListener('touchstart', (e) => {
        this.touchStartX = e.touches[0].clientX;
        this.touchDeltaX = 0;
      }, { passive: true });
      this.section.addEventListener('touchmove', (e) => {
        this.touchDeltaX = e.touches[0].clientX - this.touchStartX;
      }, { passive: true });
      this.section.addEventListener('touchend', () => {
        if (Math.abs(this.touchDeltaX) < this.swipeThreshold) return;
        this.navigate(this.touchDeltaX < 0 ? 1 : -1);
      }, { passive: true });

      // Keyboard
      this.section.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.navigate(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); this.navigate(1); }
      });

      // Click on side cards to navigate
      this.cards.forEach((card, i) => {
        card.addEventListener('click', () => {
          if (i !== this.activeIndex && !this.isAnimating) this.goTo(i);
        });
      });

      // Read more buttons → open modal
      this.section.querySelectorAll('.ugc-mood__read-more').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const modalId = btn.dataset.modalTarget;
          if (modalId) this.openModal(modalId);
        });
      });

      // Modal close
      this.modals.forEach((modal) => {
        const closeBtn = modal.querySelector('.ugc-mood__modal-close');
        const backdrop = modal.querySelector('.ugc-mood__modal-backdrop');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal(modal));
        if (backdrop) backdrop.addEventListener('click', () => this.closeModal(modal));
      });

      // Escape key closes modal
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const openModal = this.section.querySelector('.ugc-mood__modal[aria-hidden="false"]');
          if (openModal) this.closeModal(openModal);
        }
      });
    }

    /* ── Navigation ── */
    navigate(dir) {
      const next = ((this.activeIndex + dir) % this.total + this.total) % this.total;
      this.goTo(next);
    }

    goTo(index) {
      if (index === this.activeIndex || this.isAnimating) return;
      if (index < 0 || index >= this.total) return;
      this.isAnimating = true;
      this.activeIndex = index;
      this.update();

      setTimeout(() => {
        this.isAnimating = false;
      }, 400);
    }

    update() {
      const prevIdx = ((this.activeIndex - 1) % this.total + this.total) % this.total;
      const nextIdx = (this.activeIndex + 1) % this.total;

      this.cards.forEach((card, i) => {
        const isActive = i === this.activeIndex;
        const isPrev = i === prevIdx;
        const isNext = i === nextIdx;
        const isOther = !isActive && !isPrev && !isNext;

        card.classList.toggle('is-active', isActive);
        card.classList.toggle('is-prev', isPrev);
        card.classList.toggle('is-next', isNext);
        card.classList.toggle('is-after', isOther);
        card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });

      this.triggers.forEach((trigger, i) => {
        const isActive = i === this.activeIndex;
        trigger.classList.toggle('is-active', isActive);
        trigger.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    /* ── Modal ── */
    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    closeModal(modal) {
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    destroy() {
      // Cleanup if needed
    }
  }

  /* ── Init / Lifecycle ── */
  const initSection = (section) => {
    if (!section || instances.has(section)) return;
    instances.set(section, new UgcMood(section));
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
    const inst = instances.get(section);
    if (inst) inst.destroy();
    instances.delete(section);
  });

  document.addEventListener('shopify:block:select', (event) => {
    const section = event.target.closest(SELECTOR);
    if (!section) return;
    const inst = instances.get(section);
    if (!inst) return;
    const idx = inst.cards.findIndex(
      (card) => card.dataset.blockId === event.detail.blockId
    );
    if (idx >= 0) inst.goTo(idx);
  });
})();
