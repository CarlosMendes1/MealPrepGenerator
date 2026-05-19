const IS_PROD = process.env.NODE_ENV === 'production';

type Level = 'info' | 'warn' | 'error' | 'debug';
type Fields = Record<string, unknown>;

function log(level: Level, message: string, fields?: Fields) {
  const entry = {
    ts: Date.now(),
    level,
    message,
    ...fields,
  };
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(IS_PROD ? JSON.stringify(entry) : `[${level.toUpperCase()}] ${message}${fields ? ' ' + JSON.stringify(fields) : ''}`);
}

export const logger = {
  info:  (message: string, fields?: Fields) => log('info',  message, fields),
  warn:  (message: string, fields?: Fields) => log('warn',  message, fields),
  error: (message: string, fields?: Fields) => log('error', message, fields),
  debug: (message: string, fields?: Fields) => {
    if (!IS_PROD) log('debug', message, fields);
  },
};
