# Use a Debian-based Node image to avoid native build issues (sharp, etc.)
FROM node:18-bullseye-slim

WORKDIR /usr/src/app

# Install native deps often needed by image processing libs
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      python3 \
      ca-certificates \
      libvips-dev \
      ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first (cache npm install)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy app source
COPY . .

# Create data dir and set default auth dir env
RUN mkdir -p /data
ENV AUTH_DIR=/data/brindi_auth

# Expose nothing special (bot is not an HTTP server)
# Add a healthcheck (optional) — here we just check node process exists
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD pgrep node || exit 1

CMD ["node", "index.js"]
