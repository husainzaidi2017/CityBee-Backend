# ── build stage ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# devDependencies are required for `nest build`; never prune them here.
RUN npm install --include=dev
COPY . .
RUN npm run build

# ── runtime stage ─────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Cloud Run injects PORT (default 8080); main.ts reads process.env.PORT.
EXPOSE 8080
CMD ["node", "dist/main.js"]
