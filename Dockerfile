# ---- build stage ----
    FROM node:20-alpine AS builder
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    RUN npm run build
    
    # ---- runtime stage ----
    FROM node:20-alpine
    WORKDIR /app
    
    COPY package*.json ./
    RUN npm ci --only=production
    
    # Copy built output (adjust dist if different)
    COPY --from=builder /app/dist ./dist
    
    # If you need static assets/configs, copy them too (optional)
    # COPY --from=builder /app/public ./public
    
    EXPOSE 4001
    CMD ["node", "dist/index.js"]
    