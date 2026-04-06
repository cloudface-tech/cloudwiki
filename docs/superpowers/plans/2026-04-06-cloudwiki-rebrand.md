# CloudWiki Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand Wiki.js fork to CloudWiki with CloudFace design system, renaming all references, replacing assets, and updating deployment config.

**Architecture:** Skin-level rebrand on the existing Vue 3 + Quasar v2 frontend. Replace SCSS tokens with CloudFace colors, swap fonts (Inter/JetBrains Mono), create new SVG logo, and do a global string rename from Wiki.js/wikijs/requarks to CloudWiki/cloudwiki/CloudFace. All work in `feat/cloudwiki-rebrand` branch off `vega`.

**Tech Stack:** Vue 3, Quasar v2, SCSS, Node.js server, Docker, GitHub Actions

**Critical constraint:** CultBR uses `vega` branch in production. Never commit directly to `vega`. Validate every batch with `cd ux && pnpm build`.

---

### Task 1: Create feature branch

**Files:** None (git operations only)

- [ ] **Step 1: Create and switch to feature branch**

```bash
cd /Users/gabrielmowses/Documents/wiki
git checkout -b feat/cloudwiki-rebrand
```

- [ ] **Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `feat/cloudwiki-rebrand`

---

### Task 2: Replace color tokens in theme

**Files:**
- Modify: `ux/src/css/_theme.scss`

- [ ] **Step 1: Replace all SCSS variables**

Replace entire content of `ux/src/css/_theme.scss` with:

```scss
// CloudFace Design System - Quasar Theme Override

$primary   : #00C2FF;
$secondary : #06279E;
$accent    : #00C2FF;

$dark      : #101B37;

$positive  : #00D68F;
$negative  : #FF3D71;
$info      : #00C2FF;
$warning   : #FFB800;

$header : #101B37;
$sidebar: #101B37;

$dark-6: #0D0E1A;
$dark-5: #101B37;
$dark-4: #1E2D4A;
$dark-3: #2A3550;
$dark-2: #3A4560;
$dark-1: #4D556B;
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add ux/src/css/_theme.scss
git commit -m "feat: replace color tokens with CloudFace design system"
```

---

### Task 3: Update base styles — fonts, scrollbar, dark shades, header/sidebar colors

**Files:**
- Modify: `ux/src/css/_base.scss`

- [ ] **Step 1: Replace font and color references in _base.scss**

Replace the font-face block:

```scss
@font-face {
  font-family: 'Roboto Mono';
  src: url(/_assets/fonts/roboto-mono/roboto-mono.woff2);
}

.font-robotomono {
  font-family: 'Roboto Mono', Consolas, "Liberation Mono", Courier, monospace;
}
```

With:

```scss
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 300 800;
  font-display: swap;
  src: url(/_assets/fonts/inter/inter.woff2) format('woff2');
}

@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400 600;
  font-display: swap;
  src: url(/_assets/fonts/jetbrains-mono/jetbrains-mono.woff2) format('woff2');
}

.font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
}
```

Replace the `:root` CSS variables:

```scss
:root {
  --q-header: #000;
  --q-sidebar: #1976D2;
}
```

With:

```scss
:root {
  --q-header: #101B37;
  --q-sidebar: #101B37;
}
```

Replace header/sidebar background classes:

```scss
.header, .bg-header {
  background: #000;
  background: var(--q-header);
}
.sidebar, .bg-sidebar {
  background: #1976D2;
  background: var(--q-sidebar);
}
```

With:

```scss
.header, .bg-header {
  background: #101B37;
  background: var(--q-header);
}
.sidebar, .bg-sidebar {
  background: #101B37;
  background: var(--q-sidebar);
}
```

Replace the bg-dark-* utility classes:

```scss
.bg-dark-6 { background-color: #070a0d; }
.bg-dark-5 { background-color: #0d1117; }
.bg-dark-4 { background-color: #161b22; }
.bg-dark-3 { background-color: #1e232a; }
.bg-dark-2 { background-color: #292f39; }
.bg-dark-1 { background-color: #343b48; }
```

With:

```scss
.bg-dark-6 { background-color: #0D0E1A; }
.bg-dark-5 { background-color: #101B37; }
.bg-dark-4 { background-color: #1E2D4A; }
.bg-dark-3 { background-color: #2A3550; }
.bg-dark-2 { background-color: #3A4560; }
.bg-dark-1 { background-color: #4D556B; }
```

Replace monospace font in textarea:

```scss
.v-textarea.is-monospaced textarea {
  font-family: 'Roboto Mono', 'Courier New', Courier, monospace;
```

With:

```scss
.v-textarea.is-monospaced textarea {
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
```

Replace scrollbar colors:

```scss
html {
  --scrollbarBG: #CCC;
  --thumbBG: #999;
}
```

With:

```scss
html {
  --scrollbarBG: #F5F7FA;
  --thumbBG: #C5CDE3;
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add ux/src/css/_base.scss
git commit -m "feat: update base styles with CloudFace fonts and colors"
```

---

### Task 4: Update Quasar brand config and font imports

**Files:**
- Modify: `ux/src/main.js`
- Modify: `ux/index.html`

- [ ] **Step 1: Update main.js brand colors**

Replace in `ux/src/main.js`:

```javascript
import '@quasar/extras/roboto-font/roboto-font.css'
```

With:

```javascript
// Inter font loaded via @font-face in _base.scss (self-hosted)
```

Replace brand config:

```javascript
    brand: {
      header: '#000',
      sidebar: '#1976D2'
    },
```

With:

```javascript
    brand: {
      header: '#101B37',
      sidebar: '#101B37'
    },
```

- [ ] **Step 2: Update index.html**

Replace in `ux/index.html`:

```html
    <title>Wiki.js</title>
```

With:

```html
    <title>CloudWiki</title>
```

Replace:

```html
    <link href="/_assets/fonts/roboto/roboto.css" rel="stylesheet" />
```

With:

```html
    <!-- Inter font loaded via @font-face in _base.scss -->
```

Replace the spinner color:

```css
        border-top: 2px solid #1976D2;
```

With:

```css
        border-top: 2px solid #00C2FF;
```

Replace body class:

```html
  <body class="wiki-root">
```

With:

```html
  <body class="cloudwiki-root">
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add ux/src/main.js ux/index.html
git commit -m "feat: update Quasar brand config and HTML template for CloudWiki"
```

---

### Task 5: Download and install Inter and JetBrains Mono font files

**Files:**
- Create: `ux/public/_assets/fonts/inter/inter.woff2`
- Create: `ux/public/_assets/fonts/jetbrains-mono/jetbrains-mono.woff2`

- [ ] **Step 1: Download Inter variable font**

```bash
mkdir -p /Users/gabrielmowses/Documents/wiki/ux/public/_assets/fonts/inter
curl -L "https://github.com/rsms/inter/releases/download/v4.1/Inter-Variable.woff2" \
  -o /Users/gabrielmowses/Documents/wiki/ux/public/_assets/fonts/inter/inter.woff2
```

Note: If the exact URL changes, download from https://github.com/rsms/inter/releases and get the variable woff2.

- [ ] **Step 2: Download JetBrains Mono variable font**

```bash
mkdir -p /Users/gabrielmowses/Documents/wiki/ux/public/_assets/fonts/jetbrains-mono
curl -L "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip" \
  -o /tmp/jbm.zip
unzip -j /tmp/jbm.zip "fonts/variable/JetBrainsMono[wght].woff2" -d /tmp/jbm/
cp /tmp/jbm/JetBrainsMono*.woff2 /Users/gabrielmowses/Documents/wiki/ux/public/_assets/fonts/jetbrains-mono/jetbrains-mono.woff2
rm -rf /tmp/jbm.zip /tmp/jbm
```

- [ ] **Step 3: Verify files exist**

Run: `ls -la /Users/gabrielmowses/Documents/wiki/ux/public/_assets/fonts/inter/ /Users/gabrielmowses/Documents/wiki/ux/public/_assets/fonts/jetbrains-mono/`
Expected: Both `.woff2` files present, non-zero size

- [ ] **Step 4: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add ux/public/_assets/fonts/inter/ ux/public/_assets/fonts/jetbrains-mono/
git commit -m "feat: add Inter and JetBrains Mono font files"
```

---

### Task 6: Create CloudWiki logo SVGs

**Files:**
- Create: `ux/public/_assets/logo-cloudwiki.svg`
- Create: `ux/public/_assets/logo-cloudwiki-full.svg`
- Create: `ux/public/favicon.svg`

- [ ] **Step 1: Create icon logo (logo-cloudwiki.svg)**

Create `ux/public/_assets/logo-cloudwiki.svg` — a minimalist cloud with integrated document page, using CloudFace gradient cyan (#00C2FF) to blue (#06279E). Viewbox 32x32, clean geometric design.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="cw" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00C2FF"/>
      <stop offset="100%" stop-color="#06279E"/>
    </linearGradient>
  </defs>
  <!-- Cloud -->
  <path d="M8 22a5 5 0 0 1-.5-9.96 7 7 0 0 1 13.36-2.73A6 6 0 0 1 26 15a6 6 0 0 1-6 6H8z" fill="url(#cw)" opacity="0.9"/>
  <!-- Document page -->
  <rect x="12" y="10" width="9" height="12" rx="1.5" fill="#fff" opacity="0.95"/>
  <path d="M17.5 10v3.5H21" fill="none" stroke="url(#cw)" stroke-width="1" stroke-linecap="round"/>
  <line x1="14" y1="16" x2="19" y2="16" stroke="#06279E" stroke-width="0.8" opacity="0.5"/>
  <line x1="14" y1="18" x2="18" y2="18" stroke="#06279E" stroke-width="0.8" opacity="0.5"/>
</svg>
```

- [ ] **Step 2: Create full logo with text (logo-cloudwiki-full.svg)**

Create `ux/public/_assets/logo-cloudwiki-full.svg` — same icon at left + "CloudWiki" text.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 32" width="180" height="32">
  <defs>
    <linearGradient id="cw" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00C2FF"/>
      <stop offset="100%" stop-color="#06279E"/>
    </linearGradient>
  </defs>
  <!-- Cloud -->
  <path d="M8 22a5 5 0 0 1-.5-9.96 7 7 0 0 1 13.36-2.73A6 6 0 0 1 26 15a6 6 0 0 1-6 6H8z" fill="url(#cw)" opacity="0.9"/>
  <!-- Document page -->
  <rect x="12" y="10" width="9" height="12" rx="1.5" fill="#fff" opacity="0.95"/>
  <path d="M17.5 10v3.5H21" fill="none" stroke="url(#cw)" stroke-width="1" stroke-linecap="round"/>
  <line x1="14" y1="16" x2="19" y2="16" stroke="#06279E" stroke-width="0.8" opacity="0.5"/>
  <line x1="14" y1="18" x2="18" y2="18" stroke="#06279E" stroke-width="0.8" opacity="0.5"/>
  <!-- Text -->
  <text x="36" y="21.5" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" fill="#101B37">Cloud<tspan fill="url(#cw)">Wiki</tspan></text>
</svg>
```

- [ ] **Step 3: Create favicon.svg**

Create `ux/public/favicon.svg` — same as icon logo, optimized for favicon.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="cw" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00C2FF"/>
      <stop offset="100%" stop-color="#06279E"/>
    </linearGradient>
  </defs>
  <path d="M8 22a5 5 0 0 1-.5-9.96 7 7 0 0 1 13.36-2.73A6 6 0 0 1 26 15a6 6 0 0 1-6 6H8z" fill="url(#cw)" opacity="0.9"/>
  <rect x="12" y="10" width="9" height="12" rx="1.5" fill="#fff" opacity="0.95"/>
  <path d="M17.5 10v3.5H21" fill="none" stroke="url(#cw)" stroke-width="1" stroke-linecap="round"/>
  <line x1="14" y1="16" x2="19" y2="16" stroke="#06279E" stroke-width="0.8" opacity="0.5"/>
  <line x1="14" y1="18" x2="18" y2="18" stroke="#06279E" stroke-width="0.8" opacity="0.5"/>
</svg>
```

- [ ] **Step 4: Commit**

```bash
git add ux/public/_assets/logo-cloudwiki.svg ux/public/_assets/logo-cloudwiki-full.svg ux/public/favicon.svg
git commit -m "feat: add CloudWiki logo and favicon SVGs"
```

---

### Task 7: Update AdminLayout — logo, title, remove donate button

**Files:**
- Modify: `ux/src/layouts/AdminLayout.vue`

- [ ] **Step 1: Update logo and title in header (lines 7-8)**

Replace:

```pug
          q-avatar(size='34px', square)
            img(src='/_assets/logo-wikijs.svg')
        q-toolbar-title.text-h6 Wiki.js
```

With:

```pug
          q-avatar(size='34px', square)
            img(src='/_assets/logo-cloudwiki.svg')
        q-toolbar-title.text-h6 CloudWiki
```

- [ ] **Step 2: Remove donate button (lines 48-58)**

Remove the entire donate q-item block:

```pug
        q-item.q-mb-sm
          q-item-section
            q-btn.acrylic-btn(
              flat
              color='pink'
              icon='las la-heart'
              :label='t(`admin.contribute.title`)'
              no-caps
              href='https://js.wiki/donate'
              target='_blank'
              type='a'
            )
```

- [ ] **Step 3: Change badge color from pink to secondary**

Replace:

```pug
        q-badge.q-ml-sm(
          label='beta'
          color='pink'
          outline
          )
```

With:

```pug
        q-badge.q-ml-sm(
          label='beta'
          color='secondary'
          outline
          )
```

- [ ] **Step 4: Change exit button color from pink to grey-5**

Replace:

```pug
        q-btn.q-ml-md(flat, dense, icon='las la-times-circle', :label='t(`common.actions.exit`)' color='pink', to='/')
```

With:

```pug
        q-btn.q-ml-md(flat, dense, icon='las la-times-circle', :label='t(`common.actions.exit`)' color='grey-5', to='/')
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add ux/src/layouts/AdminLayout.vue
git commit -m "feat: update AdminLayout with CloudWiki branding"
```

---

### Task 8: Update Login page

**Files:**
- Modify: `ux/src/pages/Login.vue`

- [ ] **Step 1: Update template branding**

Replace:

```pug
    h2.auth-site-title CultBR Wiki
    p.text-grey-7.auth-subtitle Plataforma de Gestão Cultural do Ministério da Cultura
```

With:

```pug
    h2.auth-site-title CloudWiki
    p.text-grey-7.auth-subtitle Open-source knowledge platform
```

Replace:

```pug
    .auth-footer
      span.text-grey-5 Mantido por NEES/UFAL
```

With:

```pug
    .auth-footer
      span.text-grey-5 Powered by CloudFace
```

- [ ] **Step 2: Update CSS gradient and colors**

Replace:

```scss
 .auth {
    background: linear-gradient(135deg, #19191C 0%, #1A2744 40%, #006FEE 100%);
```

With:

```scss
 .auth {
    background: linear-gradient(135deg, #101B37 0%, #1A2847 40%, #00C2FF 100%);
```

Replace:

```scss
    &-site-title {
      font-size: 1.6rem;
      line-height: 2rem;
      font-weight: 700;
      margin: 0 0 2px 0;
      color: #19191C;
      font-family: 'Poppins', sans-serif;
    }
```

With:

```scss
    &-site-title {
      font-size: 1.6rem;
      line-height: 2rem;
      font-weight: 700;
      margin: 0 0 2px 0;
      color: #101B37;
      font-family: 'Inter', system-ui, sans-serif;
    }
```

Replace:

```scss
      &::after {
        content: 'CultBR';
        font-family: 'Poppins', sans-serif;
```

With:

```scss
      &::after {
        content: 'CloudWiki';
        font-family: 'Inter', system-ui, sans-serif;
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add ux/src/pages/Login.vue
git commit -m "feat: update Login page with CloudWiki branding and CloudFace gradient"
```

---

### Task 9: Global string rename — UI-visible "Wiki.js" strings

**Files:**
- Modify: `ux/src/layouts/ProfileLayout.vue` (titleTemplate)
- Modify: `ux/src/pages/AdminSystem.vue` (subtitle, version)
- Modify: `ux/src/pages/AdminDashboard.vue` (version messages)
- Modify: `ux/src/pages/AdminStorage.vue` (storage provider name)
- Modify: `ux/src/pages/AdminSecurity.vue` (JWT audience)
- Modify: `ux/src/pages/Search.vue` (titleTemplate)
- Modify: `ux/src/components/FooterNav.vue` (link + text)
- Modify: `ux/src/stores/site.js` (docsBase URL)
- Modify: `server/locales/en.json` (UI strings)

- [ ] **Step 1: Run sed replacements on Vue/JS files**

For each file, replace `Wiki.js` with `CloudWiki` and `wiki.js` with `cloudwiki`:

```bash
cd /Users/gabrielmowses/Documents/wiki

# Vue templates and pages
find ux/src -name "*.vue" -exec sed -i '' 's/Wiki\.js/CloudWiki/g' {} +
find ux/src -name "*.vue" -exec sed -i '' "s/logo-wikijs/logo-cloudwiki/g" {} +

# JS stores
sed -i '' "s|https://beta.js.wiki/docs|https://wiki.cloudface.tech/docs|g" ux/src/stores/site.js

# FooterNav — replace js.wiki link
sed -i '' "s|https://js.wiki|https://wiki.cloudface.tech|g" ux/src/components/FooterNav.vue

# JWT audience
sed -i '' "s/urn:wiki\.js/urn:cloudwiki/g" ux/src/pages/AdminSecurity.vue
```

- [ ] **Step 2: Update server locale strings**

```bash
sed -i '' 's/Wiki\.js/CloudWiki/g' server/locales/en.json
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add ux/src/ server/locales/
git commit -m "feat: rename all UI-visible Wiki.js strings to CloudWiki"
```

---

### Task 10: Global string rename — server code identifiers

**Files:**
- Modify: `server/core/kernel.mjs` (banner)
- Modify: `server/core/mail.mjs` (x-mailer)
- Modify: `server/core/db.mjs` (app name)
- Modify: `server/core/auth.mjs` (JWT issuer)
- Modify: `server/core/letsencrypt.js` (packageAgent)
- Modify: `server/controllers/common.mjs` (logo path)
- Modify: `server/graph/resolvers/system.mjs` (db query)
- Modify: `server/graph/resolvers/authentication.mjs` (JWT issuer)
- Modify: `server/models/users.mjs` (JWT)
- Modify: `server/models/apiKeys.mjs` (JWT)
- Modify: `server/db/migrations/3.0.0.mjs` (JWT defaults)
- Modify: `server/index.mjs` (comment)
- Modify: `server/controllers/ws.mjs` (logging)
- Modify: `server/app/data.yml` (config defaults)

- [ ] **Step 1: Run sed replacements on server files**

```bash
cd /Users/gabrielmowses/Documents/wiki

# Broad replacements
find server -name "*.mjs" -exec sed -i '' 's/Wiki\.js/CloudWiki/g' {} +
find server -name "*.mjs" -exec sed -i '' 's/wiki\.js/cloudwiki/g' {} +
find server -name "*.mjs" -exec sed -i '' 's/urn:wiki\.js/urn:cloudwiki/g' {} +
find server -name "*.mjs" -exec sed -i '' "s/logo-wikijs/logo-cloudwiki/g" {} +

# letsencrypt CJS file
sed -i '' 's/wikijs/cloudwiki/g' server/core/letsencrypt.js

# data.yml config
sed -i '' 's/Wiki\.js/CloudWiki/g' server/app/data.yml
sed -i '' 's/urn:wiki\.js/urn:cloudwiki/g' server/app/data.yml
sed -i '' 's/wikijs/cloudwiki/g' server/app/data.yml
```

- [ ] **Step 2: Verify no broken imports**

Run: `grep -rn "wiki\.js\|wikijs\|Wiki\.js" server/ --include="*.mjs" --include="*.js" --include="*.yml" | grep -v node_modules | grep -v NOTICE | grep -v LICENSE`
Expected: No matches (or only acceptable ones in comments)

- [ ] **Step 3: Commit**

```bash
git add server/
git commit -m "feat: rename server code identifiers from wikijs to cloudwiki"
```

---

### Task 11: Update module definition files (author/logo/website)

**Files:**
- Modify: All `server/modules/*/definition.yml` files (~50 files)

- [ ] **Step 1: Batch replace author, logo, and website in all definition.yml**

```bash
cd /Users/gabrielmowses/Documents/wiki

find server/modules -name "definition.yml" -exec sed -i '' \
  -e 's/author: requarks.io/author: cloudface.tech/g' \
  -e 's/author: Wiki\.js/author: CloudWiki/g' \
  -e 's|website: https://js.wiki|website: https://wiki.cloudface.tech|g' \
  -e 's|https://static.requarks.io/logo/wikijs-butterfly.svg|/_assets/logo-cloudwiki.svg|g' \
  -e 's|https://static.requarks.io/logo/wikijs.svg|/_assets/logo-cloudwiki.svg|g' \
  {} +
```

- [ ] **Step 2: Verify no remaining requarks references**

Run: `grep -rn "requarks" server/modules/ --include="*.yml"`
Expected: No matches (logos may have external URLs — check each)

- [ ] **Step 3: Commit**

```bash
git add server/modules/
git commit -m "feat: update module definitions with CloudWiki author and URLs"
```

---

### Task 12: Update package metadata

**Files:**
- Modify: `server/package.json`
- Modify: `ux/package.json`
- Modify: `blocks/package.json`

- [ ] **Step 1: Update server/package.json**

```bash
cd /Users/gabrielmowses/Documents/wiki
sed -i '' \
  -e 's/"wiki-server"/"cloudwiki-server"/g' \
  -e 's/The most powerful and extensible open source Wiki software/Open-source knowledge platform by CloudFace/g' \
  -e 's|https://github.com/Requarks/wiki.git|https://github.com/gmowses/cloudwiki.git|g' \
  -e 's|https://github.com/Requarks/wiki|https://github.com/gmowses/cloudwiki|g' \
  -e 's/requarks/cloudface/g' \
  server/package.json
```

- [ ] **Step 2: Update ux/package.json**

```bash
sed -i '' \
  -e 's/"wiki-ux"/"cloudwiki-ux"/g' \
  -e 's/The most powerful and extensible open source Wiki software/Open-source knowledge platform by CloudFace/g' \
  -e 's/"productName": "Wiki.js"/"productName": "CloudWiki"/g' \
  -e 's/Nicolas Giard <nick@requarks.io>/Gabriel Mowses <gabriel@cloudface.tech>/g' \
  ux/package.json
```

- [ ] **Step 3: Update blocks/package.json if needed**

```bash
sed -i '' \
  -e 's/wiki/cloudwiki/g' \
  blocks/package.json
```

Note: Review this file manually after sed to make sure no dependency names were broken.

- [ ] **Step 4: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add server/package.json ux/package.json blocks/package.json
git commit -m "feat: update package metadata for CloudWiki"
```

---

### Task 13: Update Dockerfile and Docker Compose

**Files:**
- Modify: `dev/build/Dockerfile`
- Modify: `docker-compose.dev.yml`
- Modify: `.devcontainer/docker-compose.yml`

- [ ] **Step 1: Update Dockerfile**

Replace:

```dockerfile
LABEL maintainer="requarks.io"
```

With:

```dockerfile
LABEL maintainer="gabriel@cloudface.tech"
```

Replace the CultBR branding sed/cp block (lines 31-35):

```dockerfile
# Replace Wiki.js branding and logo
RUN sed -i 's/Wiki\.js/CultBR Wiki/g' ./assets/index.html
RUN cp ./assets/cultbr.svg ./assets/_assets/logo-wikijs.svg && \
    cp ./assets/cultbr.svg ./assets/_assets/logo-wikijs-full.svg && \
    mkdir -p ./data/assets
```

With:

```dockerfile
# Create data assets directory
RUN mkdir -p ./data/assets
```

(The branding is now baked into the source, no runtime patching needed.)

- [ ] **Step 2: Update docker-compose.dev.yml**

```bash
sed -i '' 's/wikijs/cloudwiki/g' docker-compose.dev.yml
```

- [ ] **Step 3: Update devcontainer compose**

```bash
sed -i '' 's/js.wiki/cloudface.tech/g' .devcontainer/docker-compose.yml
```

- [ ] **Step 4: Commit**

```bash
git add dev/build/Dockerfile docker-compose.dev.yml .devcontainer/docker-compose.yml
git commit -m "feat: update Docker files for CloudWiki branding"
```

---

### Task 14: Update GitHub Actions and workflows

**Files:**
- Modify: `.github/workflows/build.yml`
- Modify: `.github/workflows/helm.yml` (if exists)

- [ ] **Step 1: Update build.yml image name**

Replace:

```yaml
  IMAGE_NAME: ghcr.io/gmowses/wiki
```

With:

```yaml
  IMAGE_NAME: ghcr.io/gmowses/cloudwiki
```

- [ ] **Step 2: Update helm.yml if it exists**

```bash
[ -f .github/workflows/helm.yml ] && sed -i '' 's/js.wiki/wiki.cloudface.tech/g' .github/workflows/helm.yml
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "feat: update GitHub Actions for CloudWiki image name"
```

---

### Task 15: Update GitHub community files

**Files:**
- Modify: `.github/CONTRIBUTING.md`
- Modify: `.github/SECURITY.md`
- Modify: `.github/ISSUE_TEMPLATE.md`
- Modify: `.github/ISSUE_TEMPLATE/config.yml`
- Modify: `.github/CODE_OF_CONDUCT.md`
- Modify: `.github/FUNDING.yml`

- [ ] **Step 1: Batch replace across all GitHub community files**

```bash
cd /Users/gabrielmowses/Documents/wiki

find .github -type f \( -name "*.md" -o -name "*.yml" \) -exec sed -i '' \
  -e 's/Wiki\.js/CloudWiki/g' \
  -e 's/wikijs/cloudwiki/g' \
  -e 's/Requarks/CloudFace/g' \
  -e 's/requarks.io/cloudface.tech/g' \
  -e 's/requarks/gmowses/g' \
  -e 's|js.wiki|wiki.cloudface.tech|g' \
  {} +
```

- [ ] **Step 2: Update FUNDING.yml specifically**

Replace entire `FUNDING.yml` content:

```yaml
github: gmowses
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "feat: update GitHub community files for CloudWiki"
```

---

### Task 16: Update LICENSE and create NOTICE

**Files:**
- Modify: `LICENSE`
- Create: `NOTICE`

- [ ] **Step 1: Add CloudFace copyright to LICENSE**

Prepend to the existing LICENSE file (keep original AGPL text intact):

```
Copyright (c) 2026 Gabriel Mowses / CloudFace (cloudface.tech)
Copyright (c) 2016-2025 Nicolas Giard / Requarks (requarks.io)

Licensed under the GNU Affero General Public License v3.0
```

- [ ] **Step 2: Create NOTICE file**

Create `/Users/gabrielmowses/Documents/wiki/NOTICE`:

```
CloudWiki
Copyright (c) 2026 Gabriel Mowses / CloudFace

This software is based on Wiki.js (https://github.com/requarks/wiki)
Copyright (c) 2016-2025 Nicolas Giard / Requarks

Licensed under AGPL-3.0
```

- [ ] **Step 3: Commit**

```bash
git add LICENSE NOTICE
git commit -m "feat: update LICENSE and add NOTICE for CloudWiki attribution"
```

---

### Task 17: Update remaining miscellaneous files

**Files:**
- Modify: `config.sample.yml`
- Modify: `server/templates/mail/Test.vue`
- Modify: `server/templates/mail/UserWelcome.vue`
- Modify: `server/templates/demo/home.md`
- Modify: `server/tasks/simple/check-version.mjs`
- Modify: `server/tasks/simple/update-locales.mjs`
- Modify: `server/renderers/modules/plantuml.mjs`
- Modify: `ux/src/renderers/modules/plantuml.js`
- Modify: `ux/src/components/EditorMarkdown.vue` (Monaco theme name)
- Modify: `ux/src/components/UtilCodeEditor.vue` (Monaco theme name)
- Modify: `dev/helm/Chart.yaml`
- Modify: `dev/helm/values.yaml`

- [ ] **Step 1: Batch sed on remaining files**

```bash
cd /Users/gabrielmowses/Documents/wiki

# Config sample
sed -i '' -e 's/Wiki\.js/CloudWiki/g' -e 's|js.wiki|wiki.cloudface.tech|g' config.sample.yml

# Mail templates
find server/templates -name "*.vue" -exec sed -i '' -e 's/Wiki\.js/CloudWiki/g' -e 's/wikijs/cloudwiki/g' {} +

# Demo content
sed -i '' 's|js.wiki|wiki.cloudface.tech|g' server/templates/demo/home.md

# Version checker — point to own repo
sed -i '' -e 's|requarks/wiki|gmowses/cloudwiki|g' server/tasks/simple/check-version.mjs

# Locale updater — point to own repo (or disable)
sed -i '' -e 's|requarks/wiki|gmowses/cloudwiki|g' server/tasks/simple/update-locales.mjs

# Monaco theme names (cosmetic, but consistent)
sed -i '' 's/wikijs-dark/cloudwiki-dark/g' ux/src/components/EditorMarkdown.vue ux/src/components/UtilCodeEditor.vue
sed -i '' 's/wikijs/cloudwiki/g' ux/src/components/EditorMarkdown.vue ux/src/components/UtilCodeEditor.vue

# Helm chart
[ -f dev/helm/Chart.yaml ] && sed -i '' \
  -e 's/Requarks/CloudFace/g' \
  -e 's|js.wiki|wiki.cloudface.tech|g' \
  dev/helm/Chart.yaml

[ -f dev/helm/values.yaml ] && sed -i '' \
  -e 's/requarks/gmowses/g' \
  -e 's/wikijs/cloudwiki/g' \
  -e 's/Requarks/CloudFace/g' \
  dev/helm/values.yaml
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add config.sample.yml server/templates/ server/tasks/ server/renderers/ ux/src/components/ ux/src/renderers/ dev/helm/ CHANGELOG.md
git commit -m "feat: update remaining files with CloudWiki branding"
```

---

### Task 18: Delete old Wiki.js logo files

**Files:**
- Delete: `ux/public/_assets/logo-wikijs.svg`
- Delete: `ux/public/_assets/logo-wikijs-full.svg`

- [ ] **Step 1: Verify no remaining references to old logos**

Run: `grep -rn "logo-wikijs" ux/src/ server/ --include="*.vue" --include="*.mjs" --include="*.js" --include="*.pug"`
Expected: No matches

- [ ] **Step 2: Delete old files**

```bash
git rm ux/public/_assets/logo-wikijs.svg ux/public/_assets/logo-wikijs-full.svg
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove old Wiki.js logo files"
```

---

### Task 19: Final audit — grep for any remaining references

**Files:** None (verification only)

- [ ] **Step 1: Search for remaining Wiki.js references**

```bash
cd /Users/gabrielmowses/Documents/wiki
grep -rn "Wiki\.js\|wikijs\|wiki-js\|wiki\.js\|requarks\|Requarks\|js\.wiki\|logo-wikijs" \
  --include="*.vue" --include="*.mjs" --include="*.js" --include="*.scss" \
  --include="*.css" --include="*.html" --include="*.yml" --include="*.yaml" \
  --include="*.json" --include="*.md" \
  . | grep -v node_modules | grep -v .git/ | grep -v NOTICE | grep -v LICENSE | grep -v pnpm-lock
```

Expected: Only matches in NOTICE and LICENSE files. Fix any remaining matches found.

- [ ] **Step 2: Full build verification**

```bash
cd /Users/gabrielmowses/Documents/wiki/ux && pnpm build
```

Expected: Build succeeds with zero errors

- [ ] **Step 3: Fix any remaining references found in step 1**

If any references remain, fix them with targeted sed commands and commit:

```bash
git add -A
git commit -m "chore: fix remaining Wiki.js references"
```

---

### Task 20: Write README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README content**

Write a new `README.md` for CloudWiki with:
- CloudWiki name and tagline
- Brief description (fork of Wiki.js 3.0 with CloudFace design system)
- Features list
- Quick start (Docker)
- License (AGPL-3.0)
- Link to wiki.cloudface.tech

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for CloudWiki"
```
