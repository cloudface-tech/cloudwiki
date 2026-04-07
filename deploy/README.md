# CloudWiki Production Deployment

## Prerequisites
- Docker and Docker Compose v2
- Domain pointing to your server (A record)
- Ports 80 and 443 open

## Quick Start

1. Copy and configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. Start services:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

3. Access CloudWiki at https://your-domain.com

4. Login with the admin credentials from .env

## Backup

```bash
# Database backup
docker compose -f docker-compose.prod.yml exec db pg_dump -U cloudwiki cloudwiki > backup.sql

# Restore
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U cloudwiki cloudwiki
```

## Update

```bash
docker compose -f docker-compose.prod.yml pull cloudwiki
docker compose -f docker-compose.prod.yml up -d cloudwiki
```
