# =============================================================================
# Stage 1: Builder — build assets, install deps, prepare modules
# =============================================================================
FROM node:24-slim AS builder

RUN apt-get update && apt-get install -qy --no-install-recommends \
    build-essential \
    librsvg2-bin \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /build

COPY ./server/package.json ./server/pnpm-lock.yaml ./server/
RUN cd server && pnpm install --prod --frozen-lockfile

COPY ./assets ./assets
COPY ./blocks/compiled ./blocks/compiled
COPY ./server ./server

# Inject mermaid.js and Inter font into index.html
RUN sed -i 's|</head>|<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700\&display=swap" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script><script>document.addEventListener("DOMContentLoaded",function(){mermaid.initialize({startOnLoad:false,theme:"default"});new MutationObserver(function(){document.querySelectorAll(".codeblock-mermaid:not([data-processed])").forEach(function(el){el.setAttribute("data-processed","1");var code=el.querySelector("code");if(code){var d=document.createElement("div");d.className="mermaid";d.textContent=code.textContent;el.replaceWith(d)}});try{mermaid.run({querySelector:".mermaid:not([data-id])"})}catch(e){}}).observe(document.body,{childList:true,subtree:true})});</script></head>|' ./assets/index.html

# Generate favicon PNGs from SVG
RUN rsvg-convert -w 16 -h 16 ./assets/_assets/logo-cloudwiki.svg -o ./assets/_assets/favicon-16.png && \
    rsvg-convert -w 32 -h 32 ./assets/_assets/logo-cloudwiki.svg -o ./assets/_assets/favicon-32.png && \
    rsvg-convert -w 48 -h 48 ./assets/_assets/logo-cloudwiki.svg -o ./assets/_assets/favicon-48.png

# Fix CJS modules: rename .js to .cjs and create ESM wrappers
RUN find ./server/modules/authentication -name "authentication.js" -exec sh -c \
    'mv "{}" "$(dirname {})"/authentication.cjs && printf "import{createRequire}from\"module\";const require=createRequire(import.meta.url);const m=require(\"./authentication.cjs\");const w={...m,init(p,id,c){return m.init(p,{...c,key:id})}};export default w;\n" > "$(dirname {})"/authentication.mjs' \; && \
    find ./server/modules/storage -name "storage.js" -exec sh -c \
    'mv "{}" "$(dirname {})"/storage.cjs && printf "import{createRequire}from\"module\";const require=createRequire(import.meta.url);const m=require(\"./storage.cjs\");export default m;\n" > "$(dirname {})"/storage.mjs' \;

RUN echo 'export default {}' > ./server/helpers/asset.mjs

RUN find ./server/modules/storage -name "common.js" -exec sh -c 'mv "{}" "$(dirname {})"/common.cjs' \;

RUN find ./server/modules/storage -name "*.cjs" -exec sed -i \
    -e "s|require('../../../helpers/page.js')|require('../../../helpers/page.mjs')|g" \
    -e "s|require('../../../helpers/page')|require('../../../helpers/page.mjs')|g" \
    -e "s|require('../../../helpers/asset.js')|require('../../../helpers/asset.mjs')|g" \
    -e "s|require('../../../helpers/asset')|require('../../../helpers/asset.mjs')|g" \
    -e "s|require('../../../helpers/common.js')|require('../../../helpers/common.mjs')|g" \
    -e "s|require('../../../helpers/common')|require('../../../helpers/common.mjs')|g" \
    -e "s|require('../disk/common')|require('../disk/common.cjs')|g" \
    {} \;

RUN touch ./server/node_modules/sharp/wiki_installed.txt

# =============================================================================
# Stage 2: Runtime — minimal production image
# =============================================================================
FROM node:24-slim

LABEL maintainer="cloudface.tech"

RUN apt-get update && apt-get install -qy --no-install-recommends \
    bash \
    curl \
    pandoc \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /wiki /logs /wiki/data/content && \
    chown -R node:node /wiki /logs

WORKDIR /wiki

COPY --from=builder --chown=node:node /build/assets ./assets
COPY --from=builder --chown=node:node /build/blocks/compiled ./blocks/compiled
COPY --from=builder --chown=node:node /build/server ./server
COPY --chown=node:node ./dev/build/config.yml ./config.yml
COPY --chown=node:node ./LICENSE ./LICENSE
COPY --chown=node:node ./dev/build/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER node

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/healthz || exit 1

VOLUME ["/wiki/data/content"]
EXPOSE 3000 3443

CMD ["./entrypoint.sh"]
