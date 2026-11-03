const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class WindowsLogger {
  constructor() {
    this.logsDir = path.join(app.getPath('userData'), 'logs');
    this.ensureDir();
  }

  ensureDir() {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create logs directory:', e);
    }
  }

  getLogFilePath() {
    const today = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `hotel-rj-${today}.log`);
  }

  /**
   * Only logs WARNINGS and ERRORS (No order details or sensitive customer info)
   */
  log(level, category, message, errorObj = null) {
    if (level !== 'WARN' && level !== 'ERROR' && category !== 'SyncServer' && category !== 'Firewall') {
      return; // Filter out normal debug/info logs as requested
    }

    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    let logLine = `[${timestamp}] [${level}] [${category}] ${message}`;

    if (errorObj) {
      if (errorObj.stack) {
        logLine += `\nStack: ${errorObj.stack}`;
      } else if (typeof errorObj === 'object') {
        try {
          logLine += `\nDetails: ${JSON.stringify(errorObj)}`;
        } catch {}
      } else {
        logLine += `\nDetails: ${String(errorObj)}`;
      }
    }

    logLine += '\n';

    try {
      fs.appendFileSync(this.getLogFilePath(), logLine, 'utf8');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  warn(category, message, details) {
    this.log('WARN', category, message, details);
  }

  error(category, message, errorObj) {
    this.log('ERROR', category, message, errorObj);
  }

  getLogsDirectory() {
    return this.logsDir;
  }
}

module.exports = new WindowsLogger();
