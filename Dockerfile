FROM node:20.18.1-bookworm AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20.18.1-bookworm AS backend-deps
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends build-essential python3 python-is-python3 pkg-config libsqlite3-dev ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_BROWSER_DOWNLOAD=true
ENV npm_config_python=/usr/bin/python3
COPY backend/package*.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true PUPPETEER_SKIP_BROWSER_DOWNLOAD=true npm ci --omit=dev
COPY backend/ ./

FROM node:20.18.1-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-noto-cjk libsqlite3-0 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_DIALECT=sqlite
ENV DB_STORAGE=/data/website_check.sqlite
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
COPY --from=backend-deps /app/backend /app/backend
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
RUN mkdir -p /app/backend/storage/screenshots /app/backend/storage/archives /app/backend/storage/downloads /data
EXPOSE 3000
CMD ["node","backend/index.js"]
