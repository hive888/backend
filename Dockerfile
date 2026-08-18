FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
RUN npm prune --omit=dev

COPY . .

EXPOSE 3000
CMD ["npm","start"]
