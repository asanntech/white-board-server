# ----------
# Build stage
# ----------
FROM public.ecr.aws/docker/library/node:22-alpine AS builder

ARG ENVIRONMENT

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install deps with frozen lockfile for reproducible builds
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# Generate Prisma client
COPY prisma ./prisma
RUN pnpm prisma generate

# Copy source and build
COPY . .

# Create .env from template if provided (e.g., .prod-env.tmpl -> .env)
RUN if [ -n "$ENVIRONMENT" ] && [ -f .${ENVIRONMENT}-env.tmpl ]; then cp .${ENVIRONMENT}-env.tmpl .env; fi

RUN pnpm build && pnpm prune --prod

# ----------
# Production stage
# ----------
FROM public.ecr.aws/docker/library/node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Copy only runtime artifacts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose the Nest.js port (default 4000) for ECS health checks
EXPOSE 4000

# Set non-root user for security
RUN addgroup -S nodegrp && adduser -S nodeusr -G nodegrp
USER nodeusr

# Default command (PORT can be overridden by ECS)
ENV PORT=4000
CMD ["node", "dist/main.js"]


