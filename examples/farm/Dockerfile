FROM node:20-slim
ENV YARN_VERSION=4.6.0

# Add these environment variables
ENV FORCE_COLOR=0
ENV YARN_ENABLE_PROGRESS_BARS=false
ENV YARN_ENABLE_COLORS=false

RUN corepack enable && corepack prepare yarn@${YARN_VERSION}

WORKDIR /app

# Copy package files first for better caching
COPY package.json yarn.lock lerna.json tsconfig.json tsconfig.base.json ./
COPY .yarnrc.yml ./
COPY .yarn ./.yarn

# Copy the rest of the application
COPY packages ./packages
COPY examples ./examples

# Install dependencies (including devDependencies)
RUN yarn install

# Build all packages
RUN yarn build

# Now set production mode for runtime
ENV NODE_ENV=production

# Copy config files
COPY examples/farm/config /app/config
ENV MESHQL_CONFIG_PATH=/app/config/config.conf

# Start the service
CMD ["yarn", "start"]
# CMD ["tail", "-f", "/dev/null"] 