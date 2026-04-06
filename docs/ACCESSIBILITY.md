# Accessibility (a11y) Guidelines

## Goal

CloudWiki targets **WCAG 2.1 Level AA** compliance across all pages.

---

## How to run a11y tests

### Component-level (vitest-axe)

```bash
cd ux
pnpm test src/__tests__/accessibility/
```

### End-to-end (Playwright + axe-core)

Start the dev server first, then run Playwright:

```bash
# terminal 1
pnpm dev          # starts on http://localhost:3000

# terminal 2
pnpm test:e2e e2e/accessibility.spec.js
```

---

## Manual test checklist

### Keyboard navigation
- [ ] Every interactive element is reachable by Tab
- [ ] Tab order follows the visual reading order
- [ ] Focus indicator is clearly visible on every focused element (minimum 3:1 contrast ratio)
- [ ] No keyboard traps (Esc or Tab can always exit modals/menus)
- [ ] Forms can be submitted with Enter

### Screen reader (NVDA/JAWS on Windows, VoiceOver on macOS/iOS, TalkBack on Android)
- [ ] Page title is announced on navigation
- [ ] Headings are read in the correct hierarchy (h1 -> h2 -> h3)
- [ ] All images have meaningful alt text (or `alt=""` for decorative images)
- [ ] Form labels are announced when their input receives focus
- [ ] Error messages are announced immediately (use `role="alert"` or `aria-live`)
- [ ] Modals/dialogs trap focus while open and restore it on close
- [ ] Navigation landmarks (header, main, nav, footer) are present and announced
- [ ] Tables have caption/summary and `<th>` headers

### Zoom and responsive
- [ ] All content is usable at 200% browser zoom without horizontal scrolling
- [ ] Text can be resized to 200% without loss of content or functionality
- [ ] No content relies solely on colour to convey meaning

### Colour contrast (WCAG 1.4.3 / 1.4.6)
- [ ] Normal text (< 18 pt): contrast ratio >= 4.5:1
- [ ] Large text (>= 18 pt or 14 pt bold): contrast ratio >= 3:1
- [ ] UI components and focus indicators: contrast ratio >= 3:1

### Multimedia
- [ ] Videos have captions
- [ ] Audio content has a transcript
- [ ] Animations can be paused/stopped (respect `prefers-reduced-motion`)

---

## Known issues and remediation plan

| Issue | Affected pages | Priority | Status | Notes |
|-------|---------------|----------|--------|-------|
| Some icon-only buttons lack `aria-label` | Admin dashboard | High | Open | Add `aria-label` to all icon-only `<q-btn>` |
| Colour contrast on disabled input placeholder | Login, forms | Medium | Open | Adjust `--q-grey` token to meet 4.5:1 |
| Focus style hidden on custom dropdowns | Editor toolbar | High | Open | Override Quasar default with visible outline |
| Missing `lang` attribute on some dynamic iframes | Page embeds | Medium | Open | Set `lang` via embed options |

---

## References

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core rules](https://dequeuniversity.com/rules/axe/)
- [Quasar accessibility docs](https://quasar.dev/options/accessibility)
- [Vue a11y best practices](https://vuejs.org/guide/best-practices/accessibility)
