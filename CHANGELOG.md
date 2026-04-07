# Changelog

All notable changes to CloudWiki will be documented in this file.

## v3.0.0-beta.1 (2026-04-06)

### Added
- CloudFace design system (colors, typography, dark/light theme)
- Custom CloudWiki logo and favicon (SVG, gradient cyan to blue)
- Inter and JetBrains Mono fonts (self-hosted)
- Real-time collaboration via Hocuspocus/Y.js
- Managed groups (delegate user management to specific groups)
- Admin navigation page (Vue 3/Quasar/Pinia port)
- Professional README, CONTRIBUTING, and issue templates
- CI workflow (build verification on PRs)
- Dependabot configuration (weekly, minor/patch only)
- Auto-labeler, stale bot, and welcome bot
- Bundled EN locale at build time to prevent i18n key flash on login

### Fixed
- OIDC authentication with manual userinfo fetch
- Auth error handling with null-safe patterns
- Admin navigation menu item visibility
- Page null-safe trim operations

### Changed
- Login page with CloudFace gradient and branding
- Admin layout with updated colors and navigation
- All module definitions updated with CloudWiki metadata
- Docker image published to `ghcr.io/cloudface-tech/cloudwiki`
