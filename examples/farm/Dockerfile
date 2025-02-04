FROM node:20-slim
ENV YARN_VERSION=4.2.2

RUN corepack enable && corepack prepare yarn@${YARN_VERSION}

WORKDIR /app

COPY . .
# Install dependencies
RUN yarn install
RUN yarn build
ENV MESHQL_CONFIG_PATH=/app/config/config.conf

# Set working directory to farm example
WORKDIR /app/examples/farm

# Start the service
CMD ["yarn", "start"] 