<div align="center">

# CloudWiki

**Open-source knowledge platform**

[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat)](https://github.com/gmowses/cloudwiki/blob/main/LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/gmowses?logo=github&color=ea4aaa)](https://github.com/sponsors/gmowses)

</div>

---

CloudWiki is a powerful, open-source wiki platform built with Node.js. It features a modern admin interface, WYSIWYG and Markdown editors, real-time collaboration, OIDC/OAuth authentication, and full-text search.

Built on the [CloudFace](https://cloudface.tech) design system.

## Features

- Modern Vue 3 + Quasar admin panel
- WYSIWYG and Markdown editors with real-time collaboration
- Multiple authentication strategies (OIDC, OAuth2, SAML, LDAP, local)
- Full-text search with PostgreSQL
- Multi-site support
- Dark mode
- Internationalization (i18n)
- REST and GraphQL APIs
- Git-based storage backend
- Docker-ready deployment

## Quick Start

```bash
docker run -d \
  -p 3000:3000 \
  -e DB_TYPE=postgres \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_USER=cloudwiki \
  -e DB_PASS=your-password \
  -e DB_NAME=cloudwiki \
  ghcr.io/gmowses/cloudwiki:latest
```

## Development

```bash
# Clone
git clone https://github.com/gmowses/cloudwiki.git
cd cloudwiki

# Start dev environment
docker compose -f docker-compose.dev.yml up -d

# Install and build frontend
cd ux && pnpm install && pnpm dev

# Start server
cd ../server && pnpm install && pnpm dev
```

## License

AGPL-3.0 - See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.

---

<div align="center">
  Made by <a href="https://cloudface.tech">CloudFace</a>
</div>
