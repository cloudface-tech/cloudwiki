<div align="center">

<img src=".github/social-preview.png" alt="CloudWiki" width="720" />

<br />

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/cloudface-tech/cloudwiki?include_prereleases&style=flat-square&color=00C2FF)](https://github.com/cloudface-tech/cloudwiki/releases)
[![Tests](https://img.shields.io/badge/tests-864%20passing-00D68F?style=flat-square)](https://github.com/cloudface-tech/cloudwiki/actions)
[![GitHub Stars](https://img.shields.io/github/stars/cloudface-tech/cloudwiki?style=flat-square&color=00C2FF)](https://github.com/cloudface-tech/cloudwiki/stargazers)
[![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fcloudface--tech%2Fcloudwiki-blue?style=flat-square&logo=docker&logoColor=white)](https://ghcr.io/cloudface-tech/cloudwiki)

**Self-hosted wiki with real-time collaboration, 15+ auth providers, and a modern UI.**

[Live Demo](https://wiki.cloudface.tech) &middot; [Getting Started](#quick-start) &middot; [Contributing](#contributing) &middot; [Discussions](https://github.com/cloudface-tech/cloudwiki/discussions)

</div>

---

## Why CloudWiki?

Most wiki platforms feel stuck in 2010 or lock you into a SaaS. CloudWiki is different:

- **Modern stack** -- Vue 3, Quasar, Node.js, PostgreSQL. Fast, maintainable, hackable.
- **Real-time collaboration** -- Multiple users editing the same page simultaneously via Y.js.
- **Beautiful by default** -- [CloudFace](https://cloudface.tech) design system with dark/light UI.
- **Self-hosted, always** -- Your data stays on your servers. Deploy with Docker in minutes.
- **Extensible** -- Authentication, storage, rendering, and analytics modules.
- **864 tests** -- Unit, integration, component, E2E, and accessibility tests built in.

## Screenshots

<div align="center">
<img src=".github/screenshots/login.png" alt="CloudWiki Login" width="720" />
<p><em>Login page with CloudFace gradient and dark/light mode support</em></p>
</div>

> See the [live demo](https://wiki.cloudface.tech) with Mermaid diagrams, navigation, and full content.

## Features

| Category | Details |
|---|---|
| **Editors** | WYSIWYG (TipTap), Markdown (Monaco), live preview |
| **Auth** | OIDC, OAuth2, SAML, LDAP, CAS, Keycloak, local, Passkeys, and 15+ providers |
| **Search** | Full-text search powered by PostgreSQL |
| **Storage** | Database, Git, GitHub, S3, Azure, Google Cloud, SFTP, local disk |
| **Diagrams** | Mermaid diagrams rendered in page content |
| **Multi-site** | Run multiple wikis from a single installation |
| **i18n** | 40+ languages including complete pt-BR translation |
| **Dark mode** | Full dark/light theme with system preference detection |
| **API** | GraphQL and REST APIs |
| **Collaboration** | Real-time co-editing via Hocuspocus/Y.js |
| **Accessibility** | WCAG 2.1 AA compliance goal with automated testing |

## Quick Start

### Docker

```bash
docker run -d \
  --name cloudwiki \
  -p 3000:3000 \
  -e DB_TYPE=postgres \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_USER=cloudwiki \
  -e DB_PASS=your-password \
  -e DB_NAME=cloudwiki \
  ghcr.io/cloudface-tech/cloudwiki:latest
```

Open `http://localhost:3000` and follow the setup wizard.

### Docker Compose

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: cloudwiki
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: cloudwiki
    volumes:
      - db-data:/var/lib/postgresql/data

  cloudwiki:
    image: ghcr.io/cloudface-tech/cloudwiki:latest
    depends_on:
      - db
    ports:
      - "3000:3000"
    environment:
      DB_TYPE: postgres
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: cloudwiki
      DB_PASS: changeme
      DB_NAME: cloudwiki

volumes:
  db-data:
```

```bash
docker compose up -d
```

### Production

See [deploy/README.md](deploy/README.md) for production deployment with TLS, reverse proxy, and PostgreSQL.

## Development

```bash
git clone https://github.com/cloudface-tech/cloudwiki.git
cd cloudwiki

docker compose -f docker-compose.dev.yml up -d   # PostgreSQL
cp config.sample.yml config.yml                    # Edit DB credentials

cd ux && pnpm install && pnpm dev                  # Frontend (port 9000)
cd ../server && pnpm install && pnpm dev           # Backend (port 3000)
```

### Running Tests

```bash
cd server && pnpm test          # 763 server tests
cd ux && pnpm test              # 101 frontend tests
pnpm test:e2e                   # E2E tests (needs running server)
```

### Project Structure

```
cloudwiki/
  ux/                  # Vue 3 + Quasar frontend
    src/css/           #   CloudFace theme (SCSS)
    src/layouts/       #   Admin, Main, Auth layouts
    src/pages/         #   All pages
    src/stores/        #   Pinia stores
  server/              # Node.js backend
    core/              #   Kernel, DB, auth, mail
    graph/             #   GraphQL schema + resolvers
    models/            #   Objection.js models
    modules/           #   Auth, storage, rendering plugins
  e2e/                 # Playwright E2E tests
  deploy/              # Production Docker Compose + Caddy
```

## Contributing

We welcome contributions of all kinds -- code, docs, translations, bug reports, and ideas.

### How to contribute

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feat/my-feature`
3. **Make your changes** with clear commits
4. **Test**: `cd server && pnpm test && cd ../ux && pnpm test`
5. **Open a Pull Request** against `main`

### Good first issues

Look for issues labeled [`good first issue`](https://github.com/cloudface-tech/cloudwiki/labels/good%20first%20issue) -- specifically selected for new contributors.

### We need help with

- **Translations** -- Help translate CloudWiki into your language
- **Accessibility** -- Keyboard navigation, screen reader, ARIA labels
- **Documentation** -- Setup guides, API docs, tutorials
- **Testing** -- Unit, integration, and E2E tests
- **Themes** -- New visual themes and layout options
- **Integrations** -- Auth, storage, or analytics modules

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for full guidelines.

## Roadmap

### Now

- [x] Production deploy at [wiki.cloudface.tech](https://wiki.cloudface.tech)
- [x] TipTap editor upgraded to 2.27.2
- [x] Dark/light login page (prefers-color-scheme)
- [x] Complete pt-BR translation (1911 strings)
- [x] 864 automated tests + WCAG accessibility auditing
- [ ] **Accessibility (WCAG 2.1 AA)** -- full compliance

### Next

- [ ] **MCP Server** -- expose wiki content to Claude, Cursor, and AI agents natively
- [ ] TipTap v3 migration
- [ ] PDF export
- [ ] Mermaid diagram editor in WYSIWYG
- [ ] GitHub Sponsors
- [ ] Landing page with live demo

### Later

- [ ] AI-powered semantic search (embeddings)
- [ ] Mobile PWA reader
- [ ] Webhooks and automation (n8n, Zapier)
- [ ] Plugin marketplace
- [ ] Per-page ACLs
- [ ] Custom theme builder

Have an idea? Open a [discussion](https://github.com/cloudface-tech/cloudwiki/discussions).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3, Quasar v2, Pinia, Apollo GraphQL |
| Backend | Node.js, Express, GraphQL (Apollo Server) |
| Database | PostgreSQL (Knex.js + Objection.js) |
| Editors | TipTap (WYSIWYG), Monaco (Markdown) |
| Collaboration | Hocuspocus + Y.js |
| Diagrams | Mermaid |
| Tests | Vitest (864), Playwright, axe-core |
| Build | Vite, pnpm |
| Deploy | Docker, Helm, Traefik, GitHub Actions |

## License

CloudWiki is licensed under [AGPL-3.0](LICENSE). See [NOTICE](NOTICE) for attribution.

---

<div align="center">

Built by [CloudFace](https://cloudface.tech)

If CloudWiki is useful to you, consider giving it a star -- it helps others find the project.

</div>
