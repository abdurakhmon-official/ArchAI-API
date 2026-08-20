# ArchAI API.
#
# No browser here. Puppeteer is a dependency of the worker only
# (`worker/lib/browser.ts`), and its postinstall would otherwise try to
# download Chrome — which fails on a slim image that has no unzip, and
# would add ~400 MB to a service that never opens a page.
#
# The worker has its own image: `worker/Dockerfile`.

FROM node:22-slim AS deps

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
COPY prisma ./prisma
RUN yarn install --frozen-lockfile

FROM deps AS build

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY . .
RUN yarn build

FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV STAGE=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates dumb-init \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/generated ./generated
COPY package.json tsconfig.compile.json ./

USER node

EXPOSE 3000

# The port comes from the environment: Render, Fly and Cloud Run all pick
# their own. A hard-coded 3000 here would mark a healthy container as
# unhealthy the moment the platform chose anything else.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "-r", "tsconfig-paths/register", "dist/index.js"]
