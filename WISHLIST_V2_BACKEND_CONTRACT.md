# Wishlist v2 backend contract

## Audit result

- The review store uses new customer accounts. Its `/account/login` route redirects to Shopify's hosted customer account domain.
- This repository is a Dawn 16 theme only. It contains no Shopify app, app proxy, backend route, Customer Account API client, Admin API credential, or deployable server runtime.
- Wishlist v1 stores normalized product handles in `shift:wishlist:v1`, emits `shift:wishlist:change`, exposes `window.ShiftWishlist`, and renders `/pages/wishlist` through `sections/shift-wishlist.liquid`.
- The theme now provides the v2 local cache, merge orchestration, pending-operation retry, multi-tab updates, logout clearing, and account-switch isolation. Cross-device persistence remains blocked until this contract is implemented by an installed Shopify app.

## Required app configuration

Create the app with Shopify CLI. Configure an app proxy whose storefront prefix is `/apps/shift-wishlist`.

Define an app-owned Customer metafield in `shopify.app.toml` before writing values:

```toml
[customer.metafields.app.wishlist]
type = "json"
name = "SHIFT wishlist"
access.admin = "merchant_read"
access.customer_account = "read_write"
```

Validate the app config with `shopify app config validate --json`. Request only `read_customers,write_customers` for the server-side Admin GraphQL path. If a later implementation adds a real Customer Account API OAuth flow, request `customer_read_customers,customer_write_customers` for that client separately.

This project cannot safely choose direct Customer Account API writes today: a theme and a signed app-proxy request do not provide a Customer Account API OAuth access token. The minimum viable implementation is therefore an authenticated App Proxy whose server uses its installed-app Admin GraphQL session. The Admin token remains server-only. A future customer-authenticated app can replace the server operation with Customer Account API `metafieldsSet` without changing the browser contract.

## Authentication and identity

Every proxy request must be authenticated with Shopify's app-proxy verifier before reading any proxy parameter. Reject requests with an invalid signature, stale timestamp, missing app installation, or empty signed `logged_in_customer_id`.

The backend must derive the Customer GID from the verified `logged_in_customer_id`. It must ignore and reject any customer ID supplied in the request body or ordinary client query parameters.

No Admin token, Customer Account access token, app secret, customer ID, email, name, phone, or address may be returned to or embedded in the theme.

## GET `/apps/shift-wishlist`

Return status `200` with:

```json
{
  "items": ["the-cloud-rest", "little-horizon"],
  "scope": "opaque-account-scope",
  "version": "metafield-compare-digest"
}
```

- Read the verified Customer's app-owned `wishlist` metafield through server-side Admin GraphQL.
- Normalize malformed data to a unique array of valid product handles, preserving order and limiting it to 100 entries.
- `scope` must be a stable, non-reversible HMAC of the verified shop and customer identity using a server-only secret. It is sync metadata, not a customer ID.
- `version` should be the metafield `compareDigest`, or an equivalent compare-and-set version. Return a stable representation for a missing metafield.
- Respond with `401` when the signed customer identity is empty and `503` when the app cannot securely reach Shopify.

## PUT `/apps/shift-wishlist`

Accept only:

```json
{
  "items": ["the-cloud-rest", "pebble-pause"],
  "version": "metafield-compare-digest"
}
```

- Enforce `Content-Type: application/json`, a small body-size limit, an array shape, valid handles, uniqueness, and a maximum of 100 items. Reject overflow; never silently truncate an existing wishlist.
- Write the complete normalized set with the Admin GraphQL `metafieldsSet` mutation against the verified Customer and the app-owned metafield definition.
- Use `compareDigest` for compare-and-set protection. If the supplied version is stale, return `409` with the same shape as GET and the latest server value so the client can rebase additions and removals once.
- On success, return `200` with the persisted `items`, `scope`, and new `version`.
- Do not implement a fallback that trusts a client customer ID or calls Admin GraphQL from theme JavaScript.

## Privacy and deletion

The theme stores only product handles and sync metadata. The app must include this metafield in its customer-data erasure handling and remove or anonymize any server logs that could associate wishlist requests with a customer after the applicable retention period.

## Required verification before claiming completion

1. Scaffold and install the app in a development/review configuration.
2. Validate app configuration, lint, typecheck, test signature rejection, guest rejection, malformed payloads, overflow, compare-and-set conflicts, and Customer Account API errors.
3. Verify guest-to-login union and remove synchronization with a real customer.
4. Verify the same customer's saved items in two independent browsers/devices.
5. Verify account A logout followed by account B login does not merge A's cached items into B.

Until those checks pass, status is: `BLOCKED — frontend integration complete, secure server-side Shopify customer write path required`.
