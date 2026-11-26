# SHIFT Wishlist

This is a Shopify-hosted, extension-only Customer Account app. It does not require a web process, App Proxy, database, OAuth redirect, or self-hosted backend.

## Included resources

- `shopify.app.production.toml`: production app configuration and app-owned Customer metafield definition
- `extensions/saved-pieces`: `customer-account.page.render` extension
- Customer Account API `2026-10` reads and writes `$app.wishlist`
- Storefront API access renders saved product information

## Local checks

```sh
npm test
npm run lint
npm run typecheck
shopify app build --config production
shopify app config validate --config production --json
```

Deploying or releasing an app version is a separate production operation and is not part of the theme review workflow.
