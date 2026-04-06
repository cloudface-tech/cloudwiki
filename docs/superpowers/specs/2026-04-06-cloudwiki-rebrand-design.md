# CloudWiki — Full Rebrand Design Spec

**Date:** 2026-04-06
**Author:** Gabriel Mowses
**Status:** Draft
**Branch:** `feat/cloudwiki-rebrand` (from `vega`)

## Context

Wiki.js 3.0 fork (branch `vega`) is running in production for CultBR at `wiki.dev.cultbr.cultura.gov.br`. The goal is to rebrand the entire codebase from Wiki.js to CloudWiki under the CloudFace identity, then launch as an independent open-source project.

**Critical constraint:** CultBR uses this wiki in production. All changes must be made in a dedicated branch (`feat/cloudwiki-rebrand`) and validated before merging. The `vega` branch must remain stable and deployable at all times.

## 1. Identity

| Field | Value |
|---|---|
| Name | CloudWiki |
| Tagline | Open-source knowledge platform |
| Domain | wiki.cloudface.tech |
| License | AGPL-3.0 |
| Copyright | Copyright (c) 2026 Gabriel Mowses / CloudFace |
| NOTICE | "Based on Wiki.js by requarks.io" (LICENSE/NOTICE only) |
| Repo | github.com/gmowses/cloudwiki (rename from `wiki`) |
| Docker image | ghcr.io/gmowses/cloudwiki |
| Package name | cloudwiki |

## 2. Design System — Color Tokens

Replace all SCSS variables in `ux/src/css/_theme.scss`:

### Primary Palette

| Token | Current (Wiki.js) | New (CloudFace) |
|---|---|---|
| `$primary` | `#006FEE` | `#00C2FF` |
| `$secondary` | `#39DDA2` | `#06279E` |
| `$accent` | `#FFCF00` | `#00C2FF` |

### Semantic Colors

| Token | Current | New |
|---|---|---|
| `$positive` | `#39DDA2` | `#00D68F` |
| `$negative` | `#FF385C` | `#FF3D71` |
| `$info` | `#5BA7FF` | `#00C2FF` |
| `$warning` | `#FFD361` | `#FFB800` |

### Dark Theme Shades

| Token | Current | New |
|---|---|---|
| `$dark` | `#19191C` | `#101B37` |
| `$dark-1` | `#4B5570` | `#4D556B` |
| `$dark-2` | `#3A4560` | `#3A4560` |
| `$dark-3` | `#2A3550` | `#2A3550` |
| `$dark-4` | `#1A2744` | `#1E2D4A` |
| `$dark-5` | `#19191C` | `#101B37` |
| `$dark-6` | `#0D0D0E` | `#0D0E1A` |

### Surface Colors

| Token | Current | New |
|---|---|---|
| `$header` | `#19191C` | `#101B37` |
| `$sidebar` | `#19191C` | `#101B37` |

### Gradients

- **Primary gradient:** `linear-gradient(135deg, #00C2FF 0%, #06279E 100%)`
- **Surface dark gradient:** `linear-gradient(180deg, #101B37 0%, #1A2847 100%)`
- **Subtle gradient:** `linear-gradient(135deg, #CCDAFF 0%, #C4BFEB 100%)`

### Shadows

Replace `rgba(16, 27, 55, ...)` based shadows from CloudFace DS `tokens.css`:
- `--shadow-glow: 0 0 24px rgba(0, 194, 255, 0.25)` for interactive elements

## 3. Typography

### Fonts

| Role | Current | New |
|---|---|---|
| Sans-serif | Roboto | Inter |
| Monospace | Roboto Mono | JetBrains Mono |

### Implementation

- Remove Roboto `.woff2` files from `ux/public/_assets/fonts/`
- Add Inter and JetBrains Mono `.woff2` files (self-hosted, no Google Fonts CDN dependency)
- Update `@font-face` declarations in `ux/src/css/_base.scss`
- Update `font-family` stacks to match CloudFace DS: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Mono: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace`

## 4. Logo & Branding Assets

### Logo Design

SVG icon: minimalist cloud with an integrated document/page element. Uses the CloudFace gradient (cyan `#00C2FF` to blue `#06279E`). Clean, geometric, works at small sizes.

### Files to Create

| File | Purpose | Replaces |
|---|---|---|
| `ux/public/_assets/logo-cloudwiki.svg` | Icon (~32x32) | `logo-wikijs.svg` |
| `ux/public/_assets/logo-cloudwiki-full.svg` | Icon + "CloudWiki" text | `logo-wikijs-full.svg` |
| `ux/public/favicon.svg` | Favicon (SVG) | `favicon.ico` |
| `ux/public/favicon.ico` | Favicon (ICO fallback) | `favicon.ico` |

### Files to Delete

- `ux/public/_assets/logo-wikijs.svg`
- `ux/public/_assets/logo-wikijs-full.svg`

## 5. Global String Rename

### Search-and-replace map

| Pattern | Replacement | Scope |
|---|---|---|
| `Wiki.js` | `CloudWiki` | All files (UI strings, comments, docs) |
| `wiki.js` | `cloudwiki` | All files |
| `WikiJS` / `WIKIJS` | `CloudWiki` / `CLOUDWIKI` | Code identifiers |
| `wikijs` | `cloudwiki` | Package names, CSS classes, URLs |
| `wiki-js` | `cloudwiki` | Kebab-case identifiers |
| `requarks.io` | Remove (keep only in NOTICE) | All except LICENSE/NOTICE |
| `Requarks` | Remove | All except LICENSE/NOTICE |
| `requarks` | Remove | All except LICENSE/NOTICE |

### Exclusions

- `node_modules/`, `.git/`, build artifacts
- `LICENSE` file (keep original copyright + add CloudFace copyright)
- `NOTICE` file (required attribution)

### Caution

Some renames may break imports, GraphQL schemas, or config keys. Each rename must be validated with a build + test cycle. The approach: rename in small batches by category (UI strings first, then package config, then code identifiers).

## 6. File-by-File Change Map

### Theme / CSS

| File | Changes |
|---|---|
| `ux/src/css/_theme.scss` | All color variables per section 2 |
| `ux/src/css/_base.scss` | font-family, scrollbar colors, font imports |
| `ux/src/css/app.scss` | Font import URLs |
| `ux/src/css/_page-contents.scss` | Verify no hardcoded colors (should inherit) |

### Quasar Config

| File | Changes |
|---|---|
| `ux/src/main.js` | `brand.header` -> `#101B37`, `brand.sidebar` -> `#101B37` |
| `ux/vite.config.js` | Verify sassVariables path still works |

### Layouts

| File | Changes |
|---|---|
| `ux/src/layouts/AdminLayout.vue` | Title "Wiki.js" -> "CloudWiki", badge color, logo path, header bg |
| `ux/src/layouts/MainLayout.vue` | Logo path, header branding |
| `ux/src/layouts/AuthLayout.vue` | If exists: logo, gradient |
| `ux/src/layouts/ProfileLayout.vue` | Logo if referenced |

### Pages

| File | Changes |
|---|---|
| `ux/src/pages/Login.vue` | Gradient CultBR -> CloudFace, logo, title |
| `ux/src/pages/Index.vue` | Welcome text, branding |
| All `Admin*.vue` pages | Scan for hardcoded "Wiki.js" strings |

### Components

| File | Changes |
|---|---|
| `ux/src/components/HeaderNav.vue` | Logo reference |
| `ux/src/components/WelcomeOverlay.vue` | Branding text |
| `ux/src/components/AuthLoginPanel.vue` | Branding |
| All components | Grep for "wiki" strings |

### Server

| File | Changes |
|---|---|
| `package.json` | name, description, homepage, repository |
| `server/core/kernel.mjs` | Startup banner, branding strings |
| `server/controllers/auth.mjs` | Error page titles if any |
| `server/views/` or HTML templates | Meta tags, title, OG tags |
| `dev/build/Dockerfile` | Labels, image name |

### Root Files

| File | Changes |
|---|---|
| `LICENSE` | Add CloudFace copyright header, keep original |
| `NOTICE` (new) | Attribution to Wiki.js / requarks.io |
| `README.md` | Complete rewrite for CloudWiki |
| `.github/workflows/` | Image names, repo references |

## 7. Branching & Safety Strategy

```
vega (production - CultBR)
 └── feat/cloudwiki-rebrand (all rebrand work)
      ├── commits are small, atomic, buildable
      └── each commit verified with: npm run build (ux/)
```

### Rules

1. **Never commit directly to `vega`** — all work in `feat/cloudwiki-rebrand`
2. **Each commit must build** — run `cd ux && npm run build` after each change
3. **Batch renames by risk level:**
   - Batch 1: CSS/theme changes (visual only, zero logic risk)
   - Batch 2: Logo/font assets (file swaps)
   - Batch 3: UI strings in Vue templates (visible text)
   - Batch 4: Package config (package.json, Dockerfile, CI)
   - Batch 5: Code identifiers (highest risk, smallest batch)
4. **Verify after each batch** with a full build
5. **CultBR continues on `vega`** until rebrand is validated and merged

### Rollback

If anything breaks after merge to `vega`:
- `git revert` the merge commit
- CultBR deployment is unaffected (points to specific commit/tag)

## 8. CultBR Compatibility

The CultBR deployment at `wiki.dev.cultbr.cultura.gov.br` uses:
- Docker image: `ghcr.io/gmowses/wiki:latest`
- Helm chart: `gitlab.ufal.br:nees/fomento-direto/cultbr/infra/tools/wikijs`
- OIDC auth with GitLab

After the rebrand merges to `vega`:
- Update Helm chart to point to new image `ghcr.io/gmowses/cloudwiki`
- Update GitHub Actions to push to new image name
- Tag a transitional release that publishes to BOTH image names
- CultBR Helm values update is a one-line change (`image.repository`)

## 9. Out of Scope

- Rewriting admin panel in React
- Changing Fluent icon set
- Redesigning WYSIWYG editor
- Plugin system changes
- New features — this is purely a rebrand
