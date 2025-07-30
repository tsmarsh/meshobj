import Log4js from 'log4js';

export function configureLogging(level: string = 'info') {
    const logLevel = process.env.LOG_LEVEL || level;
    const enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';
    
    const appenders: any = {
        out: {
            type: 'stdout',
            layout: {
                type: 'pattern',
                pattern: '%d{ISO8601} [%p] %c - %m'
            }
        }
    };

    // Add file logging if enabled
    if (enableFileLogging) {
        appenders.file = {
            type: 'file',
            filename: 'logs/app.log',
            maxLogSize: 10485760, // 10MB
            backups: 5,
            layout: {
                type: 'pattern',
                pattern: '%d{ISO8601} [%p] %c - %m'
            }
        };
    }

    Log4js.configure({
        appenders,
        categories: {
            default: { 
                appenders: enableFileLogging ? ['out', 'file'] : ['out'], 
                level: logLevel 
            }
        }
    });
}

export function getLogger(category: string) {
    return Log4js.getLogger(category);
}

// Initialize logging with default configuration
configureLogging(); 