FROM oven/bun:1.1-slim

# Add these environment variables for cleaner output
ENV FORCE_COLOR=0

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package.json yarn.lock lerna.json tsconfig.json tsconfig.base.json ./
COPY .yarnrc.yml ./
COPY .yarn ./.yarn

# Copy the rest of the application
COPY core ./core
COPY repos ./repos
COPY examples ./examples

# Install dependencies using Bun
RUN bun install

# Build all packages
RUN bun run build

# Now set production mode for runtime
ENV NODE_ENV=production

# Copy config files
COPY examples/farm-bun/config /app/config
ENV MESHQL_CONFIG_PATH=/app/config/config.conf

# Use Bun to run the CLI
CMD ["bun", "run", "core/cli/dist/cli.js", "--config", "/app/config/config.conf"] 