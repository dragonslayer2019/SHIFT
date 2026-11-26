import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useCallback, useEffect, useMemo, useState} from 'preact/hooks';
import {HANDLE_PATTERN, MAX_ITEMS, normalizeItems} from './wishlist-data.js';

/* global navigation */
/* eslint-disable react/prop-types -- checkJs validates extension component props. */

const API_VERSION = '2026-10';
const CUSTOMER_API_URL = `shopify://customer-account/api/${API_VERSION}/graphql.json`;

const READ_WISHLIST = `#graphql
  query WishlistRead {
    customer {
      id
      wishlist: metafield(namespace: "$app", key: "wishlist") {
        jsonValue
        compareDigest
      }
    }
  }
`;

const WRITE_WISHLIST = `#graphql
  mutation WishlistWrite($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        jsonValue
        compareDigest
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const FIND_PRODUCT = `#graphql
  query WishlistProduct($handle: String!) {
    product(handle: $handle) {
      handle
      title
      onlineStoreUrl
      featuredImage { url altText }
      priceRange { minVariantPrice { amount currencyCode } }
    }
  }
`;

const STOREFRONT_URL = `#graphql
  query StorefrontUrl {
    shop { primaryDomain { url } }
  }
`;

class WishlistError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message);
    this.code = code;
  }
}

async function customerGraphql(query, variables) {
  const response = await fetch(CUSTOMER_API_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query, variables}),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length) {
    throw new WishlistError('Customer Account API request failed', 'CUSTOMER_API');
  }
  return result.data;
}

async function readWishlist() {
  const data = await customerGraphql(READ_WISHLIST);
  if (!data?.customer?.id) {
    throw new WishlistError('No authenticated customer was available', 'AUTH');
  }

  return {
    customerId: data.customer.id,
    items: normalizeItems(data.customer.wishlist?.jsonValue),
    version: data.customer.wishlist?.compareDigest ?? null,
  };
}

async function writeWishlist(customerId, items, version) {
  const data = await customerGraphql(WRITE_WISHLIST, {
    metafields: [{
      ownerId: customerId,
      namespace: '$app',
      key: 'wishlist',
      type: 'json',
      value: JSON.stringify(items),
      compareDigest: version,
    }],
  });
  const result = data?.metafieldsSet;
  const errors = result?.userErrors ?? [];
  if (errors.some(({code}) => code === 'STALE_OBJECT')) {
    throw new WishlistError('Wishlist changed in another session', 'STALE_OBJECT');
  }
  if (errors.length || !result?.metafields?.[0]) {
    throw new WishlistError(errors[0]?.message || 'Wishlist could not be saved', 'WRITE');
  }

  return {
    items: normalizeItems(result.metafields[0].jsonValue),
    version: result.metafields[0].compareDigest,
  };
}

async function findProduct(handle) {
  const result = await shopify.query(FIND_PRODUCT, {variables: {handle}, version: API_VERSION});
  if (result.errors?.length) throw new WishlistError('Product lookup failed', 'STOREFRONT_API');
  const data = /** @type {any} */ (result.data);
  return data?.product ?? null;
}

async function findProducts(handles) {
  if (!handles.length) return [];
  const declarations = handles.map((_, index) => `$h${index}: String!`).join(', ');
  const fields = handles.map((_, index) => `p${index}: product(handle: $h${index}) {
    ...WishlistProduct
  }`).join('\n');
  const query = `#graphql
    query WishlistProducts(${declarations}) {
      ${fields}
    }
    fragment WishlistProduct on Product {
      handle
      title
      onlineStoreUrl
      featuredImage { url altText }
      priceRange { minVariantPrice { amount currencyCode } }
    }
  `;
  const variables = Object.fromEntries(handles.map((handle, index) => [`h${index}`, handle]));
  const result = await shopify.query(query, {variables, version: API_VERSION});
  if (result.errors?.length) throw new WishlistError('Product lookup failed', 'STOREFRONT_API');
  const data = /** @type {any} */ (result.data);
  return handles.map((handle, index) => data?.[`p${index}`] ?? {handle, unavailable: true});
}

async function getStorefrontUrl() {
  const result = await shopify.query(STOREFRONT_URL, {version: API_VERSION});
  if (result.errors?.length) return null;
  const data = /** @type {any} */ (result.data);
  return data?.shop?.primaryDomain?.url ?? null;
}

function readSaveIntent() {
  const currentUrl = navigation.currentEntry?.url;
  if (!currentUrl) return null;

  try {
    const url = new URL(currentUrl, 'https://customer-account.invalid');
    const product = url.searchParams.get('product')?.trim() ?? '';
    if (url.searchParams.get('action') !== 'save') return null;
    if (!product || product.length > 255 || !HANDLE_PATTERN.test(product)) return {invalid: true};
    return {product, currentUrl};
  } catch {
    return {invalid: true};
  }
}

function clearSaveIntent(currentUrl) {
  try {
    const base = 'https://customer-account.invalid';
    const url = new URL(currentUrl, base);
    url.searchParams.delete('action');
    url.searchParams.delete('product');
    const destination = url.origin === base
      ? `${url.pathname}${url.search}${url.hash}`
      : url.toString();
    navigation.navigate(destination, {history: 'replace'});
  } catch {
    // A non-standard host URL should not turn a successful save into a failure.
  }
}

export default async () => {
  render(<SavedPieces />, document.body);
};

function SavedPieces() {
  const {translate, formatCurrency} = shopify.i18n;
  const [wishlist, setWishlist] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyHandle, setBusyHandle] = useState(null);
  const [notice, setNotice] = useState(null);
  const [storefrontUrl, setStorefrontUrl] = useState(null);

  const loadProducts = useCallback(async (items) => {
    try {
      setProducts(await findProducts(items));
    } catch {
      setProducts(items.map((handle) => ({handle, unavailable: true})));
      setNotice({tone: 'warning', message: translate('productLoadError')});
    }
  }, [translate]);

  const mutateWishlist = useCallback(async (transform) => {
    let snapshot = wishlist ?? await readWishlist();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const nextItems = normalizeItems(transform(snapshot.items));
      try {
        const saved = await writeWishlist(snapshot.customerId, nextItems, snapshot.version);
        const next = {...snapshot, ...saved};
        setWishlist(next);
        await loadProducts(next.items);
        return next;
      } catch (error) {
        if (error.code !== 'STALE_OBJECT' || attempt === 1) throw error;
        snapshot = await readWishlist();
      }
    }
    throw new WishlistError('Wishlist could not be saved', 'WRITE');
  }, [loadProducts, wishlist]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setStorefrontUrl(await getStorefrontUrl().catch(() => null));
        let current = await readWishlist();
        if (!active) return;
        setWishlist(current);

        const intent = readSaveIntent();
        if (intent?.invalid) {
          setNotice({tone: 'warning', message: translate('invalidSaveIntent')});
        } else if (intent?.product) {
          const product = await findProduct(intent.product);
          if (!product) {
            setNotice({tone: 'warning', message: translate('productUnavailable')});
          } else if (current.items.includes(intent.product)) {
            setNotice({tone: 'success', message: translate('alreadySaved')});
            clearSaveIntent(intent.currentUrl);
          } else if (current.items.length >= MAX_ITEMS) {
            setNotice({tone: 'warning', message: translate('limitReached')});
          } else {
            const saved = await writeWishlist(
              current.customerId,
              [...current.items, intent.product],
              current.version,
            ).catch(async (error) => {
              if (error.code !== 'STALE_OBJECT') throw error;
              const latest = await readWishlist();
              if (latest.items.includes(intent.product)) return latest;
              const result = await writeWishlist(
                latest.customerId,
                [...latest.items, intent.product],
                latest.version,
              );
              return {...latest, ...result};
            });
            current = {...current, ...saved};
            setWishlist(current);
            setNotice({tone: 'success', message: translate('saved')});
            clearSaveIntent(intent.currentUrl);
          }
        }

        if (active) await loadProducts(current.items);
      } catch {
        if (active) setNotice({tone: 'critical', message: translate('loadError')});
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();
    return () => { active = false; };
  }, [loadProducts, translate]);

  const remove = useCallback(async (handle) => {
    setBusyHandle(handle);
    setNotice(null);
    try {
      await mutateWishlist((items) => items.filter((item) => item !== handle));
      setNotice({tone: 'success', message: translate('removed')});
    } catch {
      setNotice({tone: 'critical', message: translate('saveError')});
    } finally {
      setBusyHandle(null);
    }
  }, [mutateWishlist, translate]);

  const count = wishlist?.items.length ?? 0;
  const subheading = useMemo(
    () => count ? String(translate('savedCount', {count})) : undefined,
    [count, translate],
  );

  return (
    <s-page heading={String(translate('title'))} subheading={subheading} inlineSize="large">
      <s-stack gap="base">
        {notice && <s-banner tone={notice.tone}>{notice.message}</s-banner>}

        {loading ? (
          <s-stack gap="small" alignItems="center">
            <s-spinner accessibilityLabel={translate('loading')} />
            <s-text color="subdued">{translate('loading')}</s-text>
          </s-stack>
        ) : count === 0 ? (
          <s-section>
            <s-stack gap="base" alignItems="start">
              <s-heading>{translate('emptyTitle')}</s-heading>
              <s-text color="subdued">{translate('emptyBody')}</s-text>
              {storefrontUrl && (
                <s-button href={`${storefrontUrl}/collections/catalog`} variant="primary">
                  {translate('browseCatalog')}
                </s-button>
              )}
            </s-stack>
          </s-section>
        ) : (
          <s-stack gap="base" accessibilityRole="unordered-list">
            {products.map((product) => (
              <SavedProduct
                key={product.handle}
                product={product}
                loading={busyHandle === product.handle}
                formatCurrency={formatCurrency}
                onRemove={() => remove(product.handle)}
                translate={translate}
              />
            ))}
          </s-stack>
        )}
      </s-stack>
    </s-page>
  );
}

function SavedProduct({product, loading, formatCurrency, onRemove, translate}) {
  const price = product.priceRange?.minVariantPrice;
  const priceText = price
    ? formatCurrency(Number(price.amount), {currency: price.currencyCode})
    : null;
  const productUrl = product.onlineStoreUrl ?? null;

  return (
    <s-section accessibilityLabel={product.title || product.handle}>
      <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
        <s-product-thumbnail
          src={product.featuredImage?.url}
          alt={product.featuredImage?.altText || product.title || ''}
        />
        <s-stack gap="small-100">
          <s-heading>{product.title || product.handle}</s-heading>
          {priceText && <s-text color="subdued">{priceText}</s-text>}
          {product.unavailable && (
            <s-text tone="warning" type="small">{translate('productUnavailable')}</s-text>
          )}
        </s-stack>
        <s-stack gap="small" alignItems="end">
          {productUrl && <s-button href={productUrl}>{translate('viewProduct')}</s-button>}
          <s-button
            tone="critical"
            variant="secondary"
            loading={loading}
            disabled={loading}
            onClick={onRemove}
          >
            {translate('remove')}
          </s-button>
        </s-stack>
      </s-grid>
    </s-section>
  );
}
