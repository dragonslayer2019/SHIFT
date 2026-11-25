import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAX_ITEMS, handleWishlistRequest, normalizeStoredItems, validateClientItems } from './wishlist.server.js';

const SHOP = 'shift-45299.myshopify.com';
const URL =
  'https://example.test/app-proxy/wishlist?shop=shift-45299.myshopify.com&logged_in_customer_id=42&signature=signed';

const graphResponse = (value) => ({ json: async () => value });
const context = (graphql) => ({
  admin: { graphql },
  session: { shop: SHOP },
});
const run = (request, graphql, authenticateAppProxy = async () => context(graphql)) =>
  handleWishlistRequest(request, {
    authenticateAppProxy,
    scopeSecret: 'test-secret',
  });
const getRequest = (url = URL) => new Request(url);
const putRequest = (body, headers = {}) =>
  new Request(URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('wishlist normalization', () => {
  test('normalizes stored duplicates and invalid values', () => {
    assert.deepEqual(normalizeStoredItems([' alpha ', 'alpha', null, 'Bad Handle', 'beta']), ['alpha', 'beta']);
    assert.deepEqual(normalizeStoredItems(null), []);
  });

  test('limits corrupt stored data to 100 valid handles', () => {
    assert.equal(
      normalizeStoredItems(Array.from({ length: MAX_ITEMS + 2 }, (_, index) => `item-${index}`)).length,
      MAX_ITEMS,
    );
  });

  test('rejects invalid client shapes and overflow', () => {
    assert.throws(() => validateClientItems(null), /array/);
    assert.throws(() => validateClientItems(['valid', 1]), /string/);
    assert.throws(() => validateClientItems(['Bad Handle']), /valid Shopify/);
    assert.throws(
      () => validateClientItems(Array.from({ length: MAX_ITEMS + 1 }, (_, index) => `item-${index}`)),
      /at most 100/,
    );
    assert.deepEqual(validateClientItems(['alpha', 'alpha', ' beta ']), ['alpha', 'beta']);
  });
});

describe('wishlist App Proxy authentication', () => {
  test('propagates invalid proxy signature rejection', async () => {
    await assert.rejects(
      () =>
        run(
          getRequest(),
          async () => {},
          async () => {
            throw new Response(null, { status: 401 });
          },
        ),
      (error) => error instanceof Response && error.status === 401,
    );
  });

  test('rejects a signed guest', async () => {
    const response = await run(
      getRequest(
        'https://example.test/app-proxy/wishlist?shop=shift-45299.myshopify.com&logged_in_customer_id=&signature=signed',
      ),
      async () => {},
    );
    assert.equal(response.status, 401);
  });
});

describe('wishlist GET', () => {
  test('returns a stable missing metafield representation', async () => {
    const response = await run(getRequest(), async () =>
      graphResponse({
        data: { customer: { wishlist: null } },
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.items, []);
    assert.equal(body.version, null);
    assert.match(body.scope, /^[a-f0-9]{64}$/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  test('returns valid and normalizes corrupt metafield data', async () => {
    const valid = await run(getRequest(), async () =>
      graphResponse({
        data: { customer: { wishlist: { jsonValue: ['alpha', 'beta'], compareDigest: 'digest-1' } } },
      }),
    );
    assert.deepEqual((await valid.json()).items, ['alpha', 'beta']);

    const corrupt = await run(getRequest(), async () =>
      graphResponse({
        data: { customer: { wishlist: { jsonValue: { bad: true }, compareDigest: 'digest-2' } } },
      }),
    );
    assert.deepEqual((await corrupt.json()).items, []);
  });
});

describe('wishlist PUT', () => {
  test('creates with compareDigest null and returns the saved digest', async () => {
    let variables;
    const response = await run(
      putRequest({ items: ['alpha', 'alpha', 'beta'], version: null }),
      async (_query, options) => {
        variables = options.variables;
        return graphResponse({
          data: {
            metafieldsSet: {
              metafields: [{ jsonValue: ['alpha', 'beta'], compareDigest: 'digest-new' }],
              userErrors: [],
            },
          },
        });
      },
    );
    assert.equal(response.status, 200);
    assert.equal(variables.metafields[0].compareDigest, null);
    assert.equal(variables.metafields[0].ownerId, 'gid://shopify/Customer/42');
    assert.deepEqual((await response.json()).items, ['alpha', 'beta']);
  });

  test('updates using the supplied digest', async () => {
    let digest;
    const response = await run(putRequest({ items: ['alpha'], version: 'digest-old' }), async (_query, options) => {
      digest = options.variables.metafields[0].compareDigest;
      return graphResponse({
        data: {
          metafieldsSet: {
            metafields: [{ jsonValue: ['alpha'], compareDigest: 'digest-new' }],
            userErrors: [],
          },
        },
      });
    });
    assert.equal(response.status, 200);
    assert.equal(digest, 'digest-old');
  });

  test('returns latest state on a CAS conflict', async () => {
    let calls = 0;
    const response = await run(putRequest({ items: ['alpha'], version: 'stale' }), async (query) => {
      calls += 1;
      if (query.includes('mutation WishlistWrite')) {
        return graphResponse({
          data: {
            metafieldsSet: {
              metafields: [],
              userErrors: [{ code: 'STALE_OBJECT', field: ['metafields', '0'], message: 'stale' }],
            },
          },
        });
      }
      return graphResponse({
        data: {
          customer: {
            wishlist: {
              jsonValue: ['remote'],
              compareDigest: 'latest',
            },
          },
        },
      });
    });
    assert.equal(response.status, 409);
    assert.equal(calls, 2);
    const body = await response.json();
    assert.deepEqual(body.items, ['remote']);
    assert.equal(body.version, 'latest');
    assert.match(body.scope, /^[a-f0-9]{64}$/);
  });

  test('rejects malformed versions and Shopify errors', async () => {
    const badVersion = await run(putRequest({ items: ['alpha'], version: 'bad' }), async () =>
      graphResponse({
        data: {
          metafieldsSet: {
            metafields: [],
            userErrors: [
              { code: 'INVALID_COMPARE_DIGEST', field: ['metafields', '0', 'compareDigest'], message: 'invalid' },
            ],
          },
        },
      }),
    );
    assert.equal(badVersion.status, 422);

    const unavailable = await run(getRequest(), async () => graphResponse({ errors: [{ message: 'unavailable' }] }));
    assert.equal(unavailable.status, 503);
  });

  test('rejects unsupported identity fields and oversized payloads', async () => {
    const identity = await run(putRequest({ items: [], version: null, customer_id: '99' }), async () => {});
    assert.equal(identity.status, 400);

    const oversized = await run(
      putRequest({ items: [], version: null }, { 'Content-Length': String(16 * 1024 + 1) }),
      async () => {},
    );
    assert.equal(oversized.status, 413);
  });
});
