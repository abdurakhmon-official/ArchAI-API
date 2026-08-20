FROM node:22-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
COPY prisma ./prisma

ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN yarn install --frozen-lockfile

FROM deps AS build

WORKDIR /app
COPY . .
RUN yarn build

FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV STAGE=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     chromium \
     openssl ca-certificates dumb-init \
     fonts-liberation fonts-noto-core fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/generated ./generated
COPY package.json tsconfig.compile.json ./

USER node

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "process.exit(0)"

ENTRYPOINT ["dumb-init", "--"]
# `tsc-alias` build paytida `@/` yo'llarini nisbiy yo'llarga aylantiradi,
# ya'ni ish vaqtida `tsconfig-paths` kerak emas. Uni chaqirish esa
# obrazda `tsconfig.json` yo'qligi haqida chalg'ituvchi ogohlantirish
# chiqarardi.
CMD ["node", "dist/worker/index.js"]
