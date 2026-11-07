/**
 * Hotel RJ In-App Live Debug Logger
 * Captures console events, native bridge logs, and user actions
 * Allows waiters & managers to view live logs directly on their phone screen
 * and persists warnings & errors to Windows disk when running in desktop mode.
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  category: string;
  message: string;
  details?: any;
}

type LogListener = (logs: LogEntry[]) => void;

class AppLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 150;

  constructor() {
    this.init();
  }

  private init() {
    // Intercept uncaught window errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.error('WindowError', event.message || 'Uncaught error', {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const msg = typeof reason === 'object' && reason ? (reason.message || String(reason)) : String(reason);
        this.error('UnhandledPromise', msg || 'Promise rejected without error message', {
          stack: reason?.stack,
        });
      });
    }

    this.info('System', 'App logger initialized');
  }

  public log(level: LogEntry['level'], category: string, message: string, details?: any) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      level,
      category,
      message,
      details,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Mirror to standard console
    if (level === 'error') {
      console.error(`[${category}] ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[${category}] ${message}`, details || '');
    } else {
      console.log(`[${category}] ${message}`, details || '');
    }

    // Forward to Windows persistent disk log file if running on Electron
    if (typeof window !== 'undefined' && (window as any).ElectronAPI) {
      try {
        const api = (window as any).ElectronAPI;
        if (level === 'error' && typeof api.logError === 'function') {
          api.logError(category, message, details);
        } else if (level === 'warn' && typeof api.logWarning === 'function') {
          api.logWarning(category, message);
        }
      } catch {}
    }

    this.notify();
  }

  public info(category: string, message: string, details?: any) {
    this.log('info', category, message, details);
  }

  public warn(category: string, message: string, details?: any) {
    this.log('warn', category, message, details);
  }

  public error(category: string, message: string, details?: any) {
    this.log('error', category, message, details);
  }

  public success(category: string, message: string, details?: any) {
    this.log('success', category, message, details);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    this.info('System', 'Logs cleared by user');
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const current = [...this.logs];
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (e) {
        console.error('Error in log listener', e);
      }
    });
  }
}

export const Logger = new AppLogger();
