# --- Build stage: compiles the client (Vite) and server (tsc), and builds
# --- better-sqlite3's native addon against this image's libc (musl).
FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

# --- Runtime stage: no build toolchain, just the compiled output and
# --- pruned production dependencies (including the already-built native addon).
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
COPY --from=build /app/package.json ./package.json

# DATABASE_PATH defaults to ./data/quiz.sqlite — mount a persistent volume
# at /app/data on your host so the lead list survives restarts/redeploys.
VOLUME ["/app/data"]

EXPOSE 8080

CMD ["node", "dist/server/server/index.js"]
