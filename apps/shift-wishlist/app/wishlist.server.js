import { createHmac } from 'node:crypto';

export const MAX_ITEMS = 100;
export const MAX_BODY_BYTES = 16 * 1024;
export const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

const READ_WISHLIST = `#graphql
  query WishlistRead($customerId: ID!) {
    customer(id: $customerId) {
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

class ClientInputError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

class UpstreamError extends Error {}

export function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function normalizeStoredItems(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const items = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue;
    const handle = candidate.trim();
    if (handle.length > 255 || !HANDLE_PATTERN.test(handle) || seen.has(handle)) {
      continue;
    }
    seen.add(handle);
    items.push(handle);
    if (items.length === MAX_ITEMS) break;
  }
  return items;
}

export function validateClientItems(value) {
  if (!Array.isArray(value)) {
    throw new ClientInputError('items must be an array');
  }
  if (value.length > MAX_ITEMS) {
    throw new ClientInputError(`items must contain at most ${MAX_ITEMS} entries`);
  }

  const seen = new Set();
  const items = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string') {
      throw new ClientInputError('each item must be a string');
    }
    const handle = candidate.trim();
    if (handle.length > 255 || !HANDLE_PATTERN.test(handle)) {
      throw new ClientInputError('each item must be a valid Shopify product handle');
    }
    if (!seen.has(handle)) {
      seen.add(handle);
      items.push(handle);
    }
  }
  return items;
}

export function buildScope(secret, shop, customerId) {
  return createHmac('sha256', secret).update(`shift-wishlist:v1:${shop}:${customerId}`).digest('hex');
}

async function parsePutBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ClientInputError('Content-Type must be application/json', 400);
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new ClientInputError('request body is too large', 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new ClientInputError('request body is too large', 413);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ClientInputError('request body must be valid JSON', 400);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ClientInputError('request body must be an object', 400);
  }
  if (Object.keys(payload).some((key) => !['items', 'version'].includes(key))) {
    throw new ClientInputError('request body contains unsupported fields', 400);
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'version')) {
    throw new ClientInputError('version is required');
  }
  if (payload.version !== null && (typeof payload.version !== 'string' || payload.version.length > 500)) {
    throw new ClientInputError('version must be a compare digest or null');
  }

  return { items: validateClientItems(payload.items), version: payload.version };
}

function customerGid(customerId) {
  if (!/^\d+$/.test(customerId)) return null;
  return `gid://shopify/Customer/${customerId}`;
}

async function parseGraphqlResponse(response) {
  const result = await response.json();
  if (!result || result.errors?.length) throw new UpstreamError('Admin GraphQL failed');
  return result.data;
}

export async function readWishlist(admin, customerId) {
  const response = await admin.graphql(READ_WISHLIST, {
    variables: { customerId },
  });
  const data = await parseGraphqlResponse(response);
  if (!data?.customer) throw new UpstreamError('Customer was not available');
  const metafield = data.customer.wishlist;
  return {
    items: normalizeStoredItems(metafield?.jsonValue),
    version: metafield?.compareDigest ?? null,
  };
}

export async function writeWishlist(admin, customerId, items, version) {
  const response = await admin.graphql(WRITE_WISHLIST, {
    variables: {
      metafields: [
        {
          ownerId: customerId,
          key: 'wishlist',
          type: 'json',
          value: JSON.stringify(items),
          compareDigest: version,
        },
      ],
    },
  });
  const data = await parseGraphqlResponse(response);
  const result = data?.metafieldsSet;
  const errors = result?.userErrors ?? [];
  if (errors.some(({ code }) => code === 'STALE_OBJECT')) {
    return { conflict: true };
  }
  if (errors.some(({ code }) => code === 'INVALID_COMPARE_DIGEST')) {
    throw new ClientInputError('version is not a valid compare digest');
  }
  if (errors.length > 0 || !result?.metafields?.[0]) {
    throw new UpstreamError('Shopify rejected the wishlist write');
  }
  return {
    conflict: false,
    items: normalizeStoredItems(result.metafields[0].jsonValue),
    version: result.metafields[0].compareDigest,
  };
}

function payload(remote, scope) {
  return { items: remote.items, scope, version: remote.version };
}

export async function handleWishlistRequest(request, options) {
  const { authenticateAppProxy, scopeSecret } = options;
  const { admin, session } = await authenticateAppProxy(request);
  const url = new URL(request.url);
  const signedCustomerId = url.searchParams.get('logged_in_customer_id') || '';
  const gid = customerGid(signedCustomerId);

  if (!gid) return jsonResponse({ error: 'customer_login_required' }, 401);
  if (!admin || !session?.shop || !scopeSecret) {
    return jsonResponse({ error: 'wishlist_service_unavailable' }, 503);
  }

  const scope = buildScope(scopeSecret, session.shop, signedCustomerId);
  try {
    if (request.method === 'GET') {
      return jsonResponse(payload(await readWishlist(admin, gid), scope));
    }
    if (request.method !== 'PUT') {
      return jsonResponse({ error: 'method_not_allowed' }, 405, { Allow: 'GET, PUT' });
    }

    const input = await parsePutBody(request);
    const saved = await writeWishlist(admin, gid, input.items, input.version);
    if (saved.conflict) {
      const latest = await readWishlist(admin, gid);
      return jsonResponse(payload(latest, scope), 409);
    }
    return jsonResponse(payload(saved, scope));
  } catch (error) {
    if (error instanceof ClientInputError) {
      return jsonResponse({ error: 'invalid_request', message: error.message }, error.status);
    }
    console.error('Wishlist proxy request failed', {
      shop: session.shop,
      category: error instanceof UpstreamError ? 'shopify_admin' : 'internal',
    });
    return jsonResponse({ error: 'wishlist_service_unavailable' }, 503);
  }
}
