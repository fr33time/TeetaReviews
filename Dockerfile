# Two stages so the image that runs in production carries no build tooling.
# There are no native modules anywhere in the tree, so this builds in seconds
# and cannot break on a base-image bump.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/web/dist ./web/dist

# Run unprivileged. The node image already ships this user.
USER node

EXPOSE 3000
CMD ["node", "server/index.js"]
