# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/app/package.json apps/app/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace @weldcosta/app --workspace @weldcosta/shared --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
RUN npm run build --workspace @weldcosta/shared
COPY apps/app apps/app
# Persist transformed modules across source edits; Expo validates its cache keys.
ARG EXPO_MAX_WORKERS=1
RUN --mount=type=cache,id=weldcosta-web-metro,target=/tmp/metro-cache,sharing=locked \
    EXPO_PUBLIC_API_URL=/api EXPO_NO_DOTENV=1 npm run export:web --workspace @weldcosta/app -- --max-workers ${EXPO_MAX_WORKERS}

FROM nginx:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/app/dist /usr/share/nginx/html
EXPOSE 80
