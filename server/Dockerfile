FROM node:20-bullseye-slim

# Native build deps for the `canvas` npm package (used by services/thumbnailGenerator.js
# to render breaking-news thumbnails). The apt install is hardened against flaky
# Debian mirror downloads:
#   - Acquire::Retries=5    auto-retry on connection-reset errors
#   - --fix-missing         tolerate one-off missing-package errors and retry
#   - --no-install-recommends keeps the layer slim
RUN apt-get update -o Acquire::Retries=5 && \
    apt-get install -y --no-install-recommends -o Acquire::Retries=5 --fix-missing \
        build-essential \
        libcairo2-dev \
        libpango1.0-dev \
        libjpeg-dev \
        libgif-dev \
        librsvg2-dev \
        libpixman-1-dev \
        pkg-config \
        python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 3001
CMD ["node", "index.js"]
