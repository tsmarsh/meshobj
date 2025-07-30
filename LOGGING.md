# Logging Configuration

This project uses log4js for structured logging across all packages. The logging configuration is centralized in `packages/common/src/logging.ts`.

## Features

- **Centralized Configuration**: All packages use the same logging configuration
- **Structured Logging**: Logs include timestamps, log levels, and categories
- **Environment-Based**: Log levels can be controlled via environment variables
- **File Logging**: Optional file logging for production environments
- **ESLint Protection**: ESLint rules prevent future `console.log` usage

## Usage

### Basic Usage

```typescript
import { getLogger } from '@meshobj/common';

const logger = getLogger('your-category');

logger.info('This is an info message');
logger.debug('This is a debug message', { additionalData: 'value' });
logger.warn('This is a warning message');
logger.error('This is an error message', error);
```

### Configuration

The logging is automatically configured when the common package is imported. You can customize it:

```typescript
import { configureLogging } from '@meshobj/common';

// Configure with custom level
configureLogging('debug');
```

### Environment Variables

- `LOG_LEVEL`: Set the log level (default: 'info')
- `ENABLE_FILE_LOGGING`: Enable file logging (default: false)

Example:
```bash
LOG_LEVEL=debug ENABLE_FILE_LOGGING=true npm start
```

## Log Levels

- `trace`: Most verbose logging
- `debug`: Debug information
- `info`: General information
- `warn`: Warning messages
- `error`: Error messages
- `fatal`: Fatal errors

## Categories

Each package uses its own category for better log organization:

- `meshobj/cli`: CLI application logs
- `meshobj/server`: Server logs
- `meshobj/restlette`: REST API logs
- `meshobj/graphlette`: GraphQL logs
- `meshobj/merminator`: Merminator tool logs
- `meshobj/postgres_repo`: PostgreSQL repository logs
- `meshobj/mongo_repo`: MongoDB repository logs
- `meshobj/mysql_repo`: MySQL repository logs
- `meshobj/sqlite_repo`: SQLite repository logs

## Migration from console.log

All `console.log` statements have been replaced with appropriate log4js calls:

- `console.log()` → `logger.info()` or `logger.debug()`
- `console.error()` → `logger.error()`
- `console.warn()` → `logger.warn()`

## ESLint Rules

The project includes ESLint rules to prevent future `console.log` usage:

```json
{
  "no-console": ["error", { "allow": ["warn", "error"] }]
}
```

This allows `console.warn` and `console.error` but prevents `console.log` usage.

## File Logging

When `ENABLE_FILE_LOGGING=true`, logs are written to `logs/app.log` with:
- 10MB max file size
- 5 backup files
- Structured format with timestamps

## Example Output

```
2025-07-29T20:51:40.398Z [DEBUG] meshobj/restlette - Swagger documentation generated
2025-07-29T20:51:40.650Z [INFO] meshobj/merminator - Generated JSON schema file { filename: '/path/to/file.json' }
2025-07-29T20:51:40.651Z [INFO] meshobj/server - Cleaning server
``` 