const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const util = require('util');

const parseLevel = (input) => {
  const v = String(input || '').trim().toLowerCase();
  return v in levels ? v : 'info';
};

const parseBool = (input) => {
  const v = String(input || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
};

const shouldPretty = () => {
  const fmt = String(process.env.LOG_FORMAT || '').trim().toLowerCase();
  return fmt === 'pretty' || parseBool(process.env.LOG_PRETTY);
};

const safeError = (err) => {
  if (!err) return undefined;
  return {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack,
  };
};

class Logger {
  constructor(base = {}) {
    this.base = base;
    this.level = parseLevel(process.env.LOG_LEVEL);
  }

  child(fields = {}) {
    return new Logger({ ...this.base, ...fields });
  }

  write(level, fields, msg) {
    if (levels[level] < levels[this.level]) return;
    const record = {
      ts: new Date().toISOString(),
      level,
      service: 'backend',
      env: String(process.env.NODE_ENV || '').trim() || 'development',
      ...this.base,
      ...(fields || {}),
    };
    if (msg) record.msg = msg;

    if (shouldPretty()) {
      const { ts, service, env, msg: m, err, ...rest } = record;
      const head = `${ts} ${String(level).toUpperCase()} ${m || ''}`.trim();
      const keys = Object.keys(rest).sort();
      const kv = keys
        .map((k) => {
          const v = rest[k];
          if (v === undefined) return null;
          if (v === null) return `${k}=null`;
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return `${k}=${v}`;
          return `${k}=${util.inspect(v, { depth: 3, breakLength: 120, colors: true })}`;
        })
        .filter(Boolean)
        .join(' ');
      const line = [head, `service=${service}`, `env=${env}`, kv].filter(Boolean).join(' ');
      if (level === 'error') console.error(line);
      else if (level === 'warn') console.warn(line);
      else console.log(line);
      if (err && err.stack) console.error(String(err.stack));
      return;
    }

    const line = JSON.stringify(record);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  debug(fields, msg) {
    this.write('debug', fields, msg);
  }

  info(fields, msg) {
    this.write('info', fields, msg);
  }

  warn(fields, msg) {
    this.write('warn', fields, msg);
  }

  error(fields, msg) {
    const f = { ...(fields || {}) };
    if (f.err instanceof Error) f.err = safeError(f.err);
    this.write('error', f, msg);
  }
}

const logger = new Logger();

module.exports = { logger };
