FROM node:22-bookworm-slim
WORKDIR /app
# whatsapp-web.js drives a real Chromium. Install it from Debian rather than
# letting Puppeteer download its own copy.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_NO_SANDBOX=true \
    NODE_ENV=production \
    DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
COPY lib ./lib
EXPOSE 3000
CMD ["node", "server.js"]
