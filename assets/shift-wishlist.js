(() => {
  const STORAGE_KEY = 'shift:wishlist:v1';
  const SYNC_KEY = 'shift:wishlist:sync:v2';
  const CHANGE_EVENT = 'shift:wishlist:change';
  const ERROR_EVENT = 'shift:wishlist:error';
  const MAX_ITEMS = 100;
  const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  const unique = (items) => [...new Set(items)];
  const normalize = (value) =>
    Array.isArray(value)
      ? unique(
          value
            .filter((handle) => typeof handle === 'string')
            .map((handle) => handle.trim())
            .filter((handle) => handle.length <= 255 && HANDLE_PATTERN.test(handle)),
        ).slice(0, MAX_ITEMS)
      : [];
  const sameItems = (left, right) => left.length === right.length && left.every((item, index) => item === right[index]);
  const union = (left, right) => normalize([...left, ...right]);
  const applyChanges = (items, additions, removals) => {
    const removed = new Set(removals);
    return normalize([...items.filter((item) => !removed.has(item)), ...additions.filter((item) => !removed.has(item))]);
  };
  const safeParse = (value, fallback) => {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return fallback;
    }
  };

  class WishlistStore {
    constructor() {
      this.authenticated = document.body.dataset.wishlistAuthenticated === 'true';
      this.endpoint = document.body.dataset.wishlistEndpoint || '';
      this.memory = this.readLocal();
      this.meta = this.readMeta();
      if (this.authenticated && this.meta.authState === 'authenticated') this.memory = [];
      this.sessionAdditions = [];
      this.sessionRemovals = [];
      this.syncQueue = Promise.resolve();
      this.ready = this.start();
    }

    readLocal() {
      try {
        return normalize(safeParse(window.localStorage.getItem(STORAGE_KEY) || '[]', []));
      } catch (_error) {
        return this.memory || [];
      }
    }

    readMeta() {
      let value = {};
      try {
        value = safeParse(window.localStorage.getItem(SYNC_KEY) || '{}', {});
      } catch (_error) {
        value = {};
      }
      return {
        authState: value.authState === 'authenticated' ? 'authenticated' : 'guest',
        scope: typeof value.scope === 'string' && value.scope.length <= 200 ? value.scope : null,
        version: typeof value.version === 'string' && value.version.length <= 500 ? value.version : null,
        pending: value.pending === true,
        additions: normalize(value.additions),
        removals: normalize(value.removals),
      };
    }

    writeMeta(next) {
      this.meta = {
        authState: next.authState === 'authenticated' ? 'authenticated' : 'guest',
        scope: typeof next.scope === 'string' ? next.scope : null,
        version: typeof next.version === 'string' ? next.version : null,
        pending: next.pending === true,
        additions: normalize(next.additions),
        removals: normalize(next.removals),
      };
      try {
        window.localStorage.setItem(SYNC_KEY, JSON.stringify(this.meta));
      } catch (_error) {
        return this.meta;
      }
      return this.meta;
    }

    notify(source = 'local') {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { handles: [...this.memory], source } }));
    }

    announce(message) {
      window.dispatchEvent(new CustomEvent(ERROR_EVENT, { detail: { message } }));
    }

    writeLocal(items, source = 'local') {
      this.memory = normalize(items);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memory));
      } catch (_error) {
        this.notify(source);
        return [...this.memory];
      }
      this.notify(source);
      return [...this.memory];
    }

    async start() {
      if (!this.authenticated) {
        if (this.meta.authState === 'authenticated') this.writeLocal([], 'logout');
        this.writeMeta({ authState: 'guest', pending: false, additions: [], removals: [] });
        this.notify('guest');
        return;
      }
      this.notify('cache');
      await this.queueRemoteSync();
    }

    getWishlist() {
      return [...this.memory];
    }

    isWishlisted(handle) {
      return this.memory.includes(handle);
    }

    add(handle) {
      const [normalizedHandle] = normalize([handle]);
      if (!normalizedHandle || this.memory.includes(normalizedHandle)) return this.getWishlist();
      if (this.memory.length >= MAX_ITEMS) {
        this.announce(document.body.dataset.wishlistLimitMessage || 'You can save up to 100 products.');
        return this.getWishlist();
      }
      this.recordChange(normalizedHandle, true);
      return this.writeLocal([...this.memory, normalizedHandle]);
    }

    remove(handle) {
      const [normalizedHandle] = normalize([handle]);
      if (!normalizedHandle || !this.memory.includes(normalizedHandle)) return this.getWishlist();
      this.recordChange(normalizedHandle, false);
      return this.writeLocal(this.memory.filter((item) => item !== normalizedHandle));
    }

    recordChange(handle, added) {
      if (!this.authenticated) return;
      const additions = new Set(this.meta.additions);
      const removals = new Set(this.meta.removals);
      const sessionAdditions = new Set(this.sessionAdditions);
      const sessionRemovals = new Set(this.sessionRemovals);
      if (added) {
        additions.add(handle);
        removals.delete(handle);
        sessionAdditions.add(handle);
        sessionRemovals.delete(handle);
      } else {
        removals.add(handle);
        additions.delete(handle);
        sessionRemovals.add(handle);
        sessionAdditions.delete(handle);
      }
      this.sessionAdditions = [...sessionAdditions];
      this.sessionRemovals = [...sessionRemovals];
      this.writeMeta({
        ...this.meta,
        pending: true,
        additions: [...additions],
        removals: [...removals],
      });
      this.queueRemoteSync();
    }

    toggle(handle) {
      return this.isWishlisted(handle) ? this.remove(handle) : this.add(handle);
    }

    queueRemoteSync() {
      if (!this.authenticated || !this.endpoint) return Promise.resolve(this.getWishlist());
      this.syncQueue = this.syncQueue.catch(() => undefined).then(() => this.syncRemote());
      return this.syncQueue;
    }

    async request(method, body) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(this.endpoint, {
          method,
          credentials: 'same-origin',
          headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        const payload = safeParse(await response.text(), null);
        if (!response.ok) {
          const error = new Error(`Wishlist request failed with ${response.status}`);
          error.status = response.status;
          error.payload = payload;
          throw error;
        }
        return this.normalizeRemote(payload);
      } finally {
        window.clearTimeout(timeout);
      }
    }

    normalizeRemote(payload) {
      if (!payload || !Array.isArray(payload.items) || typeof payload.scope !== 'string' || !payload.scope) {
        throw new Error('Invalid wishlist response');
      }
      return {
        items: normalize(payload.items),
        scope: payload.scope.slice(0, 200),
        version: typeof payload.version === 'string' ? payload.version.slice(0, 500) : null,
      };
    }

    async syncRemote() {
      try {
        const remote = await this.request('GET');
        const previous = this.readMeta();
        const migratedGuest = previous.authState !== 'authenticated';
        const sameScope = previous.scope === remote.scope;
        let additions = previous.additions;
        let removals = previous.removals;
        let desired;
        if (migratedGuest) {
          desired = union(remote.items, this.memory);
          additions = desired.filter((item) => !remote.items.includes(item));
          removals = [];
        } else if (!sameScope) {
          additions = [...this.sessionAdditions];
          removals = [...this.sessionRemovals];
          desired = applyChanges(remote.items, additions, removals);
        } else if (previous.pending) {
          desired = applyChanges(remote.items, additions, removals);
        } else {
          desired = remote.items;
        }
        this.writeMeta({
          authState: 'authenticated',
          scope: remote.scope,
          version: remote.version,
          pending: !sameItems(desired, remote.items),
          additions,
          removals,
        });
        if (sameItems(desired, remote.items)) {
          this.completeSync(remote);
          return this.getWishlist();
        }
        let saved;
        try {
          saved = await this.request('PUT', { items: desired, version: remote.version });
        } catch (error) {
          if (error.status !== 409 || !error.payload) throw error;
          const latest = this.normalizeRemote(error.payload);
          const rebased = applyChanges(latest.items, additions, removals);
          saved = sameItems(rebased, latest.items)
            ? latest
            : await this.request('PUT', { items: rebased, version: latest.version });
        }
        if (saved.scope !== remote.scope) throw new Error('Wishlist account scope changed');
        this.completeSync(saved);
        return this.getWishlist();
      } catch (_error) {
        this.writeMeta({
          ...this.meta,
          pending: this.meta.pending || this.sessionAdditions.length > 0 || this.sessionRemovals.length > 0,
        });
        return this.getWishlist();
      }
    }

    completeSync(remote) {
      this.sessionAdditions = [];
      this.sessionRemovals = [];
      this.writeMeta({
        authState: 'authenticated',
        scope: remote.scope,
        version: remote.version,
        pending: false,
        additions: [],
        removals: [],
      });
      this.writeLocal(remote.items, 'remote');
    }
  }

  const store = new WishlistStore();
  const api = {
    storageKey: STORAGE_KEY,
    syncKey: SYNC_KEY,
    eventName: CHANGE_EVENT,
    ready: store.ready,
    getWishlist: () => store.getWishlist(),
    isWishlisted: (handle) => store.isWishlisted(handle),
    addToWishlist: (handle) => store.add(handle),
    removeFromWishlist: (handle) => store.remove(handle),
    toggleWishlist: (handle) => store.toggle(handle),
    getWishlistCount: () => store.getWishlist().length,
    sync: () => store.queueRemoteSync(),
  };
  window.ShiftWishlist = api;

  class ShiftWishlistButton extends HTMLElement {
    connectedCallback() {
      this.button = this.querySelector('button');
      this.label = this.querySelector('[data-wishlist-label]');
      this.handle = this.dataset.productHandle;
      if (!this.button || !this.handle) return;
      this.onClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        api.toggleWishlist(this.handle);
      };
      this.onChange = () => this.render();
      this.button.addEventListener('click', this.onClick);
      window.addEventListener(CHANGE_EVENT, this.onChange);
      this.render();
    }
    disconnectedCallback() {
      this.button?.removeEventListener('click', this.onClick);
      window.removeEventListener(CHANGE_EVENT, this.onChange);
    }
    render() {
      const saved = api.isWishlisted(this.handle);
      this.button.setAttribute('aria-pressed', String(saved));
      this.button.setAttribute('aria-label', saved ? this.dataset.removeLabel : this.dataset.saveLabel);
      if (this.label) this.label.textContent = saved ? this.dataset.savedText : this.dataset.saveText;
    }
  }

  class ShiftWishlistPage extends HTMLElement {
    connectedCallback() {
      this.grid = this.querySelector('[data-wishlist-grid]');
      this.loading = this.querySelector('[data-wishlist-loading]');
      this.empty = this.querySelector('[data-wishlist-empty]');
      this.status = this.querySelector('[data-wishlist-status]');
      this.onChange = () => this.load();
      window.addEventListener(CHANGE_EVENT, this.onChange);
      this.load();
    }
    disconnectedCallback() {
      window.removeEventListener(CHANGE_EVENT, this.onChange);
    }
    formatMoney(cents) {
      try {
        return new Intl.NumberFormat(this.dataset.locale || 'en-US', {
          style: 'currency',
          currency: this.dataset.currency || 'USD',
        }).format(cents / 100);
      } catch (_error) {
        return `${(cents / 100).toFixed(2)} ${this.dataset.currency || ''}`.trim();
      }
    }
    productUrl(handle) {
      return `${this.dataset.root}products/${encodeURIComponent(handle)}`;
    }
    createCard(product) {
      const item = document.createElement('li');
      item.className = 'shift-wishlist__card';
      const imageLink = document.createElement('a');
      imageLink.className = 'shift-wishlist__image-link';
      imageLink.href = this.productUrl(product.handle);
      imageLink.setAttribute('aria-label', product.title);
      if (product.featured_image) {
        const image = document.createElement('img');
        image.className = 'shift-wishlist__image';
        image.src = typeof product.featured_image === 'string' ? product.featured_image : product.featured_image.src;
        image.alt = product.featured_image.alt || product.title;
        image.loading = 'lazy';
        image.width = 720;
        image.height = 720;
        imageLink.append(image);
      }
      const title = document.createElement('h2');
      title.className = 'shift-wishlist__card-title';
      const titleLink = document.createElement('a');
      titleLink.href = this.productUrl(product.handle);
      titleLink.textContent = product.title;
      title.append(titleLink);
      const price = document.createElement('p');
      price.className = 'shift-wishlist__price';
      price.textContent = this.formatMoney(product.price);
      if (product.compare_at_price && product.compare_at_price > product.price) {
        const compare = document.createElement('s');
        compare.className = 'shift-wishlist__compare-price';
        compare.textContent = this.formatMoney(product.compare_at_price);
        price.append(compare);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'shift-wishlist__remove';
      remove.textContent = this.dataset.removeText;
      remove.setAttribute('aria-label', this.dataset.removeLabel.replace('[title]', product.title));
      remove.addEventListener('click', () => api.removeFromWishlist(product.handle));
      item.append(imageLink, title, price, remove);
      return item;
    }
    async load() {
      this.loadVersion = (this.loadVersion || 0) + 1;
      const loadVersion = this.loadVersion;
      const handles = api.getWishlist();
      this.grid.replaceChildren();
      this.empty.hidden = true;
      this.loading.hidden = handles.length === 0;
      if (!handles.length) {
        this.loading.hidden = true;
        this.empty.hidden = false;
        if (this.status) this.status.textContent = this.dataset.loadedText.replace('[count]', '0');
        return;
      }
      const results = await Promise.allSettled(
        handles.map(async (handle) => {
          const response = await fetch(`${this.productUrl(handle)}.js`, { headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error(`Product unavailable: ${handle}`);
          return response.json();
        }),
      );
      if (loadVersion !== this.loadVersion) return;
      const products = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
      this.loading.hidden = true;
      this.grid.replaceChildren(...products.map((product) => this.createCard(product)));
      this.empty.hidden = products.length > 0;
      if (this.status) this.status.textContent = this.dataset.loadedText.replace('[count]', String(products.length));
    }
  }

  if (!customElements.get('shift-wishlist-button')) customElements.define('shift-wishlist-button', ShiftWishlistButton);
  if (!customElements.get('shift-wishlist-page')) customElements.define('shift-wishlist-page', ShiftWishlistPage);

  const updateCounts = () => {
    const count = api.getWishlistCount();
    document.querySelectorAll('[data-wishlist-count]').forEach((badge) => {
      badge.hidden = count === 0;
      badge.querySelector('[aria-hidden="true"]').textContent = count < 100 ? count : '99+';
      badge.querySelector('.visually-hidden').textContent = badge.dataset.countLabel.replace('[count]', String(count));
    });
  };
  const announceError = (event) => {
    document.querySelectorAll('[data-wishlist-feedback]').forEach((status) => {
      status.textContent = event.detail?.message || '';
    });
  };
  window.addEventListener(CHANGE_EVENT, updateCounts);
  window.addEventListener(ERROR_EVENT, announceError);
  window.addEventListener('online', () => store.queueRemoteSync());
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      store.memory = store.readLocal();
      store.notify('storage');
    }
    if (event.key === SYNC_KEY && store.authenticated) {
      store.meta = store.readMeta();
      if (store.meta.pending) store.queueRemoteSync();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateCounts, { once: true });
  else updateCounts();
})();
