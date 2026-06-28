FROM node:20-alpine

WORKDIR /app

# Run as non-root user
RUN addgroup -S app && adduser -S app -G app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R app:app /app
USER app

EXPOSE 3001
CMD ["node", "index.js"]
