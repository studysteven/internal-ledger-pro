/**
 * Logger Utility
 * 
 * Provides a simple logging system that can be controlled by environment variables.
 * In production, only errors and warnings are logged by default.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get log level from environment variable, default to 'info' in production, 'debug' in development
const getLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && LOG_LEVELS.hasOwnProperty(envLevel)) {
    return envLevel;
  }
  // Default: debug in development, info in production
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

const currentLogLevel = getLogLevel();
const minLevel = LOG_LEVELS[currentLogLevel];

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= minLevel;
};

/**
 * Logger class with different log levels
 */
export const logger = {
  debug: (...args: any[]) => {
    if (shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  },

  info: (...args: any[]) => {
    if (shouldLog('info')) {
      console.log('[INFO]', ...args);
    }
  },

  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  },

  error: (...args: any[]) => {
    if (shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  },
};

/**
 * Helper function to create a scoped logger with a prefix
 */
export const createScopedLogger = (scope: string) => ({
  debug: (...args: any[]) => logger.debug(`[${scope}]`, ...args),
  info: (...args: any[]) => logger.info(`[${scope}]`, ...args),
  warn: (...args: any[]) => logger.warn(`[${scope}]`, ...args),
  error: (...args: any[]) => logger.error(`[${scope}]`, ...args),
});


