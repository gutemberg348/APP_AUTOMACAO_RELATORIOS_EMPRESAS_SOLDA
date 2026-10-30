# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates chromium fonts-liberation && rm -rf /var/lib/apt/lists/*
ENV PDF_CHROME_EXECUTABLE=/usr/bin/chromium
ENV PDF_DISABLE_SANDBOX=true
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/app/package.json apps/app/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=weldcosta-npm,target=/root/.npm,sharing=locked \
    npm ci --workspace @weldcosta/api --workspace @weldcosta/shared --include-workspace-root \
    --prefer-offline --no-audit --no-fund --maxsockets=5 \
    --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000 --fetch-timeout=120000
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run db:generate && npm run build
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
EXPOSE 3301
CMD ["npm", "run", "start", "--workspace", "@weldcosta/api"]
