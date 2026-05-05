FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npm run build

# ---

FROM node:20-alpine AS runner

WORKDIR /app

# Only copy production deps
COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Non-root user for security
RUN addgroup -S mcp && adduser -S mcp -G mcp
USER mcp

CMD ["node", "dist/server.js"]
