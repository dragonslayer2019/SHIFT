---
name: shopify-review-handoff
description: Deliver a completed round of Shopify storefront changes for remote review by validating the code and rendered pages, updating a Draft PR, updating the designated unpublished review theme, and reporting a verified guest preview. Use after a coherent change to storefront pages, styles, or interactions is ready for review; do not use on every save or for documentation-only edits.
---

# Shopify review handoff

Create one traceable review package in which the commit, Draft PR, Shopify preview theme, visitor link, and reported checks all refer to the same code.

Never merge a PR, publish a theme, alter a live theme, or expose credentials. Explicit user instructions override this workflow.

## 1. Establish the delivery scope

1. Record the current branch, upstream, HEAD, merge base, and full staged/unstaged/untracked status.
2. Identify the files and storefront routes changed in this review round. Preserve unrelated or pre-existing local modifications; never reset, discard, stash, or overwrite them.
3. Do not deliver from the repository's default branch. If the work is on the default branch, create a descriptive work branch while carrying the current changes forward.
4. Review the diff before staging. Commit only the intended files with a clear message. If ownership or scope is ambiguous, stop and ask instead of sweeping changes into the commit.
5. Record the final commit with `git rev-parse HEAD`. Use a clean detached worktree at that SHA for Shopify checks and upload when the main worktree contains unrelated changes.

Do not use broad cleanup commands such as `git reset --hard`, `git checkout -- .`, or an indiscriminate `git add -A` when unrelated changes exist.

## 2. Validate the exact commit

Run checks from the committed version that will be pushed:

- Run `shopify theme check` with the repository's configuration and any relevant project checks.
- Compare new warnings with the baseline when practical; report counts and exact failures.
- Render and inspect every affected route at desktop and mobile widths. For the first storefront handoff, cover at least the homepage, one collection page, and one product page.
- Exercise the interactions changed by the round. Also verify the relevant navigation, search, variant selection, add-to-cart/cart behavior, keyboard path, and reduced-motion behavior when they are in scope.
- Inspect the browser console and failed network requests on tested pages.
- Include edge states that the changed UI can encounter, such as missing images, empty collections, unavailable variants, and long titles, when store data permits.

Report only checks actually run. Mark unavailable data, browsers, devices, or interactions as not run; never infer a pass from source inspection.

## 3. Push the branch and maintain a Draft PR

1. Push the current work branch and set its upstream when needed.
2. Use an authenticated GitHub integration or GitHub CLI to find an open PR for the exact head branch.
3. Create a Draft PR if none exists. If one exists, update it by pushing the branch and keep or convert it to Draft status.
4. Put the change summary, actual checks, relevant non-image artifact links, and known issues in the PR body or a comment.
5. Never merge, auto-merge, close, or mark the PR ready for review unless the user separately requests it.

If no authenticated GitHub mechanism exists, keep the commit and checks, then report the minimum action required—connect GitHub or install/authenticate GitHub CLI. Do not invent a PR URL.

## 4. Reuse one unpublished Shopify review theme

Use the local, Git-ignored state file `.shopify/review-handoff.json` to retain only non-secret metadata:

```json
{
  "store": "store-name.myshopify.com",
  "theme_id": "123456789",
  "theme_name": "SHIFT Review — do not publish",
  "role": "unpublished",
  "updated_at": "ISO-8601 timestamp"
}
```

Never put login credentials, Theme Access passwords/tokens, cookies, or Admin API secrets in this file, the repository, a PR, validation artifacts, or the report.

### First delivery

1. Confirm the target store and active Shopify authorization.
2. List themes and identify the live theme ID before any upload.
3. Create exactly one theme from the clean worktree with an explicit non-interactive name and target store: `shopify theme push --unpublished --theme "SHIFT Review — do not publish" --store <store>.myshopify.com --path <clean-worktree> --json --strict`. Do not omit `--theme`; an unnamed unpublished push can wait for interactive input or create an ambiguously named target.
4. Require the returned theme role to be `unpublished`; abort if it is `main`, `live`, `development`, or unclear.
5. Save the store, returned theme ID, exact name, role, and timestamp to the local state file.

### Later deliveries

1. Read the recorded store and theme ID.
2. Run `shopify theme list --json --id <theme-id>` and verify the exact ID still exists, has the recorded name, and has role `unpublished`.
3. Compare it with the current live theme ID. Abort if they match or if role/status cannot be proven.
4. Push the clean committed worktree only to that ID with `shopify theme push --theme <theme-id> --json --strict`.
5. Confirm the returned ID and `unpublished` role before continuing. Update the state timestamp, not the ID.

Never use `--live`, `--allow-live`, `--publish`, `shopify theme publish`, or an interactive theme selection whose target has not already been verified. If the recorded review theme was deleted or changed, stop and ask before creating a replacement; do not silently create another theme.

## 5. Produce and verify a visitor preview

Do not treat the `preview_url` returned by `shopify theme push --json` as a no-login visitor link. That value commonly uses the shop domain and `preview_theme_id`; retain it only as a merchant preview locator and never report it as the verified guest URL.

After the upload and unpublished-role checks, generate a fresh Shopify visitor preview using the current supported sharing flow:

1. Open Shopify Admin, go to **Online Store > Themes**, and preview the verified unpublished review theme.
2. In the theme preview bar, use the share/copy-link control to create a visitor preview. Browser automation may perform these steps only in the already authorized merchant session and only for the verified review theme.
3. Accept the result only when it is HTTPS and its hostname is `shopifypreview.com` or a subdomain of `shopifypreview.com`. Reject Admin URLs, shop-domain URLs containing `preview_theme_id`, and any URL whose theme cannot be tied back to the recorded theme ID.
4. If the visitor link cannot be generated automatically, ask the user to copy the visitor link from that Shopify Admin preview bar and paste it into the conversation. Preserve the completed commit, PR, upload, and theme ID while waiting; after the user supplies the link, continue unauthenticated verification.

Visitor preview links can expire, so create a new one for every handoff rather than reusing a prior link.

Validate the URL in a new unauthenticated browser context with no Shopify Admin cookies:

- Confirm the requested page loads the recorded theme ID and does not redirect to Admin or a login page.
- Confirm representative assets and page content load.
- Use the copied link as delivered for reporting. Query parameters do not create or authenticate a visitor preview.
- If the store password, authentication, expiry, or another barrier prevents guest access, report the blocker and the smallest merchant action needed. Do not fabricate or hand-edit a link and claim it works.

## 6. Deliver one consolidated report

Return these fields together:

- Draft PR URL and status
- Commit SHA and branch
- Shopify store identifier without credentials
- Preview theme ID, name, and verified `unpublished` role
- Verified guest preview URL
- Generation time with timezone
- Commands/checks actually run and their results
- Browser routes, viewports, interactions, and console/network findings
- Unresolved issues, skipped checks, blockers, and the minimum next action

Redact tokens, passwords, cookies, authorization headers, and sensitive command output. A partial handoff is acceptable when authentication or store access is unavailable; preserve completed code and evidence and label every missing artifact honestly.
