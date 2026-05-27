FROM node:24-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci

FROM deps AS build

COPY client ./client
COPY server ./server
RUN npm run build

FROM node:24-slim AS runner

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_PATH=/app/server/data/app.sqlite

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev

COPY --from=build /app/client/dist ./client/dist
COPY server ./server
RUN mkdir -p /app/server/data

EXPOSE 4000
VOLUME ["/app/server/data"]

CMD ["npm", "start"]
