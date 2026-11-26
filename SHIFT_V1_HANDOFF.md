# SHIFT v1 handoff

## Base theme

- **Theme:** Dawn 16.0.0
- **Source:** Shopify's official `Shopify/dawn` repository, release tag `v16.0.0` (`bc39a7d2024f1e5c14c42f855bd3552b4913e204`)
- **Why Dawn:** The repository was already Dawn-derived, and Dawn 16 preserves Shopify's lean, HTML-first product, variant, search, navigation, cart, accessibility, and theme-editor workflows. No other free theme offered a material advantage for the two launch use cases.

## What the first release contains

### Home

1. Clear value proposition and two purchase paths.
2. Living-space and desk-space entry points.
3. Editable featured collection with native prices and quick add.
4. Two product-in-space use cases organized by **Fits / Helps with / Feels like**.
5. Closing brand statement and shop-all action.

All missing photography, collection links, and real use cases are explicitly represented as editable placeholders.

### Collection

- Native collection description and optional collection image.
- Three short shopping cues for measuring, identifying friction, and checking fit.
- Native filters, sorting, product grid, price display, pagination, and quick add.
- Optional `custom.space_fit` product metafield shown on product cards when present.

### Product

- Dawn's native media gallery, variant picker, quantity, dynamic checkout, add-to-cart, disclosures, and related products.
- A dedicated fit section reading these product metafields:
  - `custom.dimensions`
  - `custom.best_for`
  - `custom.helps_with`
  - `custom.setup_and_care`
- Clearly marked launch placeholders appear when those metafields are empty.

### Navigation, search, and cart

- Dawn 16 header, mobile drawer, predictive search, account popover support, cart drawer, and cart page remain intact.
- Prices, currencies, tax messaging, payment methods, and policies are controlled by Shopify/store settings; none are hard-coded by SHIFT.

## Old-theme asset decisions

### Migrated as direction, not copied code

- Warm cream, coral, yellow, green, and deep-ink palette intent.
- Rounded but restrained visual language.
- Quicksand heading character, paired with Karla body text for clearer product reading.
- The useful idea of showing products in the context of small-space friction.

### Deliberately left behind

- `custom.css` and its global component overrides.
- Scene Shift Liquid, CSS, carousel, scroll choreography, breathing animation, and scene-card code.
- GSAP, ScrollTrigger, and Lottie CDN dependencies.
- Cat/dog/flower animation JSON assets.
- UGC Mood section, scripts, styles, names, reviews, ratings, and claims.
- Style-guide page/template and stray collection templates.

All removed work remains available in Git history and in the branch's preservation commit.

## Brand variables and extension rules

`assets/shift-brand.css` is a small semantic mapping layer. It does not set a second color system. It maps spacing, rule, muted text, accent, on-accent, and surface values to the active Dawn color scheme variables.

Rules for future sections:

1. Add a Dawn `color_scheme` setting and wrap the section with `color-{id} gradient`.
2. Resolve color through Dawn variables such as `--color-foreground`, `--color-background`, and `--color-button`.
3. Keep layout styles under a unique `.shift-*` class and load a section stylesheet locally.
4. Do not override generic Dawn selectors from a SHIFT section stylesheet.
5. Do not use global `!important`, CDN animation libraries, or selectors tied to undocumented Dawn DOM nesting.
6. Prefer transforms/opacity for motion and always include `prefers-reduced-motion` behavior.
7. If a base component must change, keep the hook semantic and narrow. The only current base-component extension is the optional `custom.space_fit` line in `snippets/card-product.liquid`.

## Validation performed

- `jq empty` on template, section-group, and config JSON: **passed**.
- `shopify theme check`: **passed with 0 errors and 10 warnings** across 161 files.
- The pristine Dawn 16.0.0 checkout produces the same 10 warnings across the same seven upstream files.
- `shopify theme package`: **passed**, producing a valid Dawn 16.0.0 package (moved to `/tmp/SHIFT-Dawn-16.0.0-verified.zip`).
- All JSON template section types resolve to existing Liquid files: **passed**.
- `git diff --check`: **passed**.
- Source scans found no Scene Shift, GSAP, Lottie, `1DK`, fake-review names, external CDN references, global `!important`, gradient text, or prohibited accent borders in the launch theme.
- Code inspection covered missing images, empty products/collections, long-title wrapping, keyboard focus, 44px touch targets, and reduced-motion handling.

### Not verified without a store session

No Shopify store is authenticated in the local CLI. Real Liquid rendering with store products, browser screenshots, variant inventory behavior, accelerated checkout, predictive-search responses, and cart mutations still require `shopify theme dev` against a development store. Desktop/mobile browser interaction is therefore **not claimed as passed**.

## Inputs required before launch

- Product catalog: titles, prices, variants, inventory, weights, vendors, and collection membership.
- Product metafields listed above plus optional `custom.space_fit`.
- Exact dimensions, material/care information, installation needs, rental-safety limitations, and compatibility details.
- Homepage hero, two scene images, two real product-in-space use-case images, collection images, and complete product galleries with alt text.
- Final collection handles/links for living spaces and desk spaces.
- Shipping, returns/refunds, privacy, terms, contact, and any warranty policies configured in Shopify.
- Final logo/favicon and confirmation of the cream/coral/green/yellow palette and Quicksand/Karla typography pairing.
- Any customer reviews only after real, attributable review data exists.
