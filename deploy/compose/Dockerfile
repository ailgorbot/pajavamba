# Image OCI de l'unité pv-app : interface compilée + services TypeScript exécutés par Node.js
# (suppression native des types, aucun transpileur à l'exécution).
# Règles : RI-SEC-10 (image minimale, utilisateur non root, système de fichiers en lecture seule
# au déploiement), RI-COD-10 (installation figée), RI-SCR-01 (aucun secret dans l'image).

FROM node:24-alpine AS construction
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @pajavamba/web build \
 && rm -rf node_modules apps/web/node_modules packages/*/node_modules services/*/*/node_modules deploy/units/*/node_modules \
 && pnpm install --frozen-lockfile --prod --filter @pajavamba/unit-pv-app...

FROM node:24-alpine AS execution
ENV NODE_ENV=production \
    PV_APP_HOST=0.0.0.0 \
    PV_APP_PORT=8080 \
    PV_APP_WEB_DIR=/app/apps/web/dist
WORKDIR /app
COPY --from=construction --chown=root:root /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=construction --chown=root:root /app/node_modules ./node_modules
COPY --from=construction --chown=root:root /app/packages ./packages
COPY --from=construction --chown=root:root /app/services ./services
COPY --from=construction --chown=root:root /app/deploy/units ./deploy/units
COPY --from=construction --chown=root:root /app/apps/web/dist ./apps/web/dist
COPY --from=construction --chown=root:root /app/tools/smoke ./tools/smoke
# Répertoire des secrets générés à l'installation : le volume nommé en hérite la propriété.
RUN mkdir -p /secrets && chown node:node /secrets && chmod 0755 /secrets
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1:8080/readyz || exit 1
CMD ["node", "deploy/units/pv-app/src/main.ts"]
