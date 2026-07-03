FROM node:22-alpine AS frontend-builder
WORKDIR /build
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps
COPY client/ ./
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_ENTRA_AUTHORITY
ARG VITE_ENTRA_API_SCOPE
ARG VITE_TURNSTILE_SITE_KEY
RUN npm run build

FROM node:22-alpine AS server-deps
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM server-deps AS development
COPY server/ .
RUN chown -R app:app /app
USER app
EXPOSE 3001
CMD ["node", "index.js"]

FROM server-deps AS production
COPY server/ .
COPY --from=frontend-builder /build/dist ./public/gunaso
RUN chown -R app:app /app
USER app
EXPOSE 3001
CMD ["node", "index.js"]
