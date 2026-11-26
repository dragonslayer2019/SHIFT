# Wishlist v3 architecture

Wishlist v3 replaces the v1 browser-only wishlist and the v2 App Proxy synchronization design.

## Storefront integration

- Product cards and the product page link directly to the Shopify-hosted Saved pieces Customer Account page.
- Save links use `action=save&product=<handle>`. Shopify authentication preserves the destination, and the extension validates and saves the product after sign-in.
- The Header heart links to the same Saved pieces page without a product save intent.
- The theme stores no wishlist data, exposes no wishlist JavaScript API, displays no local count, and makes no App Proxy request.
- `/pages/wishlist` is no longer a theme route.

The Customer Account page identifier for the installed `saved-pieces` extension is `01a212f7-8374-7d5f-bf93-ee2e69d8cdf4`. Theme links are generated from `routes.account_url` so Shopify controls the account host and authentication flow.

## Shopify-hosted persistence

- Production app: `SHIFT Wishlist` (`451934683137`)
- Customer Account target: `customer-account.page.render`
- Customer Account API: `2026-10`
- App-owned Customer metafield: `$app.wishlist` (`app--451934683137.wishlist`), JSON, Customer Account `read_write`
- Stored value: unique validated Product handles, maximum 100
- Conflict protection: `compareDigest` with one re-read/retry on stale writes
- Product display: Shopify Storefront API from the Customer Account extension

The extension queries only the authenticated Customer ID and its app-owned wishlist metafield. A storefront request cannot select another Customer.

## Production boundaries

- Scopes: `write_customers,customer_read_customers,customer_write_customers`
- Admin API policy: Block all requests
- No App Proxy
- No OAuth redirects
- No external network access
- No self-hosted server, database, or paid hosting

The React Router, Prisma, Admin GraphQL, App Proxy, guest merge, pending sync, and localStorage implementations from v1/v2 have been removed from the repository.

## Verification status

Real-store Save, Remove, Refresh, Re-login, duplicate protection, and compare-and-set conflict handling have passed. Independent-browser login, physical cross-device testing, and two-Customer runtime isolation remain separate E2E checks and must not be inferred from source inspection.
