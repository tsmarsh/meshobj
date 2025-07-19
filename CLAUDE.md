# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MeshQL is a service mesh that auto-generates REST and GraphQL endpoints based on domain models. It's organized as a Lerna monorepo with Yarn workspaces, supporting multiple database backends (MongoDB, PostgreSQL, MySQL, SQLite) and event-driven architectures.

## Essential Commands

### Development Workflow
```bash
# Install dependencies
yarn install

# Build all packages
yarn build

# Quick build (only changed packages since main)
yarn qb

# Run all tests with coverage
yarn test

# Quick test (only changed packages since main)
yarn qt

# Lint code
yarn lint

# Fix linting issues
yarn lint:fix

# Format code
yarn format

# Check formatting
yarn format:check

# Clean build artifacts
yarn clean

# Clean everything including node_modules
yarn clean:all
```

### Testing
- Uses Vitest for testing framework
- Tests are configured with 120s timeout for container-based tests
- Database tests use testcontainers for isolation
- Coverage reports generated in `.nyc_output`

### Starting the Server
```bash
# Start with default config
yarn start

# Start with custom config
node packages/cli/dist/cli.js --config path/to/config.conf
```

## Architecture

### Core Components
1. **@meshobj/server** - Express-based server combining GraphQL and REST
2. **@meshobj/cli** - Command-line interface for server management
3. **@meshobj/merminator** - Generates configuration from Mermaid diagrams

### Database Plugins
- **@meshobj/mongo_repo** - MongoDB integration
- **@meshobj/postgres_repo** - PostgreSQL integration  
- **@meshobj/mysql_repo** - MySQL integration
- **@meshobj/sqlite_repo** - SQLite integration

### API Components
- **@meshobj/graphlette** - GraphQL endpoint generator with relationship resolution
- **@meshobj/restlette** - REST API generator with OpenAPI docs

### Authentication
- **@meshobj/jwt_auth** - JWT token authentication
- **@meshobj/casbin_auth** - CASBIN role-based authorization

## Configuration System

Uses HOCON format for configuration files. Key structure:
```hocon
{
  port: 4044
  graphlettes: [
    {
      path: "/api/graph"
      storage: { type: "postgres", uri: "...", collection: "..." }
      schema: "path/to/schema.graphql"
      rootConfig: {
        singletons: [...]  // Single-result queries
        vectors: [...]     // Multi-result queries  
        resolvers: [...]   // Cross-service resolvers
      }
    }
  ]
  restlettes: [
    {
      path: "/api/rest"
      storage: { type: "mongo", uri: "...", collection: "..." }
      schema: { /* JSON Schema */ }
      tokens: ["auth_token"]  // Optional auth
    }
  ]
}
```

## Development Patterns

### Plugin System
All database backends implement the Plugin interface:
```typescript
interface Plugin {
  createRepository(config: StorageConfig): Promise<Repository>
  createSearcher(config: StorageConfig, dtoFactory: DTOFactory, auth: Auth): Promise<Searcher>
  cleanup(): Promise<void>
}
```

### Temporal Querying
GraphQL endpoints support temporal queries via timestamp arguments for point-in-time data retrieval.

### Cross-Service Resolution
GraphQL resolvers can query across different services/databases using the resolver configuration.

## Key Files

- `lerna.json` - Monorepo configuration
- `vitest.workspace.ts` - Test workspace configuration
- `tsconfig.base.json` - Shared TypeScript configuration
- `examples/farm/` - Complete working example with multi-database setup
- `packages/*/vitest.config.ts` - Individual package test configurations

## Examples

The `examples/farm/` directory contains a comprehensive example demonstrating:
- Multi-database architecture (MongoDB for farms, PostgreSQL for coops, MySQL for hens)
- GraphQL relationship resolution across databases
- REST API with OpenAPI documentation
- Docker containerization
- Integration testing

## Testing Notes

- Database tests require Docker for testcontainers
- Tests have extended timeouts (120s) for container startup
- Each database plugin has its own test suite
- Integration tests verify cross-service communication