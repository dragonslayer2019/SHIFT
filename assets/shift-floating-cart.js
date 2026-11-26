if (!customElements.get('shift-floating-cart')) {
  customElements.define(
    'shift-floating-cart',
    class ShiftFloatingCart extends HTMLElement {
      connectedCallback() {
        this.button = this.querySelector('button');
        this.count = this.querySelector('.shift-floating-cart__count');
        this.liveText = this.querySelector('[data-cart-live-text]');
        this.drawer = document.querySelector('cart-drawer');
        this.lastCount = Number(this.count?.textContent) || 0;

        this.button?.addEventListener('click', () => {
          if (this.drawer?.open) {
            this.drawer.open(this.button);
          } else {
            window.location.href = window.routes.cart_url;
          }
        });

        if (this.drawer) {
          this.drawerObserver = new MutationObserver(() => this.syncDrawerState());
          this.drawerObserver.observe(this.drawer, { attributes: true, attributeFilter: ['class'] });
          this.syncDrawerState();
        }

        if (typeof subscribe === 'function' && window.PUB_SUB_EVENTS?.cartUpdate) {
          this.unsubscribe = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
            const itemCount = event?.cartData?.item_count;
            if (Number.isInteger(itemCount)) this.updateCount(itemCount, true);
          });
        }

        this.headerRoot = document.querySelector('header');
        if (this.headerRoot) {
          this.headerObserver = new MutationObserver(() => this.syncFromHeader());
          this.headerObserver.observe(this.headerRoot, { childList: true, subtree: true });
        }
      }

      disconnectedCallback() {
        this.unsubscribe?.();
        this.drawerObserver?.disconnect();
        this.headerObserver?.disconnect();
      }

      syncDrawerState() {
        this.hidden = this.drawer?.classList.contains('active') || false;
      }

      syncFromHeader() {
        const headerCount = document.querySelector('#cart-icon-bubble .cart-count-bubble [aria-hidden="true"]');
        const itemCount = headerCount ? Number(headerCount.textContent.trim()) : 0;
        if (Number.isInteger(itemCount) && itemCount !== this.lastCount) this.updateCount(itemCount, true);
      }

      updateCount(itemCount, announce = false) {
        this.lastCount = itemCount;
        this.count.textContent = itemCount > 99 ? '99+' : String(itemCount);
        this.button.setAttribute('aria-label', `Open cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`);
        if (announce) this.liveText.textContent = `Cart updated: ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
      }
    },
  );
}
