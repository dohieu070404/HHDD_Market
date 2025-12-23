FROM node:20-bullseye-slim

WORKDIR /app

# netcat để wait DB, openssl/libssl1.1 có sẵn trên bullseye
RUN apt-get update && apt-get install -y --no-install-recommends \
    netcat-openbsd \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
