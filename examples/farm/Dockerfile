FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY examples/farm/package.json ./examples/farm/

# Install dependencies
RUN yarn install

# Copy source files
COPY . .

# Build the application
RUN yarn build
ENV MESHQL_CONFIG_PATH=/app/config/config.conf

# Set working directory to farm example
WORKDIR /app/examples/farm

# Start the service
CMD ["yarn", "start"] 