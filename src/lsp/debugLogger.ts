import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { debugLog } from "../mcp/utils/errorHandler.ts";

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  error?: Error;
}

export interface DebugSession {
  sessionId: string;
  adapter: string;
  startTime: Date;
  endTime?: Date;
  logEntries: LogEntry[];
  metrics: {
    totalRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    featureUsage: Record<string, number>;
  };
}

export class DebugLogger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logFile?: string;
  private sessions: Map<string, DebugSession> = new Map();
  private currentSession?: string;
  private enableFileLogging = false;
  private enableConsoleLogging = true;

  constructor(options?: {
    logLevel?: LogLevel;
    logFile?: string;
    enableFileLogging?: boolean;
    enableConsoleLogging?: boolean;
  }) {
    if (options?.logLevel !== undefined) {
      this.logLevel = options.logLevel;
    }

    if (options?.logFile) {
      this.logFile = options.logFile;
      this.enableFileLogging = true;
      this.ensureLogDirectoryExists();
    }

    if (options?.enableFileLogging !== undefined) {
      this.enableFileLogging = options.enableFileLogging;
    }

    if (options?.enableConsoleLogging !== undefined) {
      this.enableConsoleLogging = options.enableConsoleLogging;
    }
  }

  /**
   * Start a new debug session
   */
  startSession(adapter: string, sessionId?: string): string {
    const id = sessionId || `${adapter}-${Date.now()}`;

    const session: DebugSession = {
      sessionId: id,
      adapter,
      startTime: new Date(),
      logEntries: [],
      metrics: {
        totalRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        featureUsage: {},
      },
    };

    this.sessions.set(id, session);
    this.currentSession = id;

    this.log(
      LogLevel.INFO,
      "DebugLogger",
      `Started debug session: ${id} for adapter: ${adapter}`
    );

    return id;
  }

  /**
   * End the current debug session
   */
  endSession(sessionId?: string): DebugSession | undefined {
    const id = sessionId || this.currentSession;
    if (!id) return undefined;

    const session = this.sessions.get(id);
    if (!session) return undefined;

    session.endTime = new Date();
    this.log(LogLevel.INFO, "DebugLogger", `Ended debug session: ${id}`);

    if (this.currentSession === id) {
      this.currentSession = undefined;
    }

    return session;
  }

  /**
   * Get a debug session
   */
  getSession(sessionId?: string): DebugSession | undefined {
    const id = sessionId || this.currentSession;
    return id ? this.sessions.get(id) : undefined;
  }

  /**
   * Log a message
   */
  log(
    level: LogLevel,
    component: string,
    message: string,
    data?: unknown,
    error?: Error
  ): void {
    if (level > this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      error,
    };

    // Add to current session if available
    if (this.currentSession) {
      const session = this.sessions.get(this.currentSession);
      if (session) {
        session.logEntries.push(entry);
      }
    }

    // Output to console if enabled
    if (this.enableConsoleLogging) {
      this.logToConsole(entry);
    }

    // Output to file if enabled
    if (this.enableFileLogging && this.logFile) {
      this.logToFile(entry);
    }
  }

  /**
   * Log LSP request/response
   */
  logLSPRequest(
    method: string,
    params?: unknown,
    requestId?: string | number
  ): void {
    this.log(LogLevel.DEBUG, "LSP-Request", `${method}`, {
      method,
      params,
      requestId,
      timestamp: Date.now(),
    });

    // Update metrics
    if (this.currentSession) {
      const session = this.sessions.get(this.currentSession);
      if (session) {
        session.metrics.totalRequests++;
        session.metrics.featureUsage[method] =
          (session.metrics.featureUsage[method] || 0) + 1;
      }
    }
  }

  /**
   * Log LSP response
   */
  logLSPResponse(
    method: string,
    result?: unknown,
    error?: unknown,
    requestId?: string | number,
    responseTime?: number
  ): void {
    const level = error ? LogLevel.ERROR : LogLevel.DEBUG;
    const message = error ? `${method} - ERROR` : `${method} - OK`;

    this.log(level, "LSP-Response", message, {
      method,
      result,
      error,
      requestId,
      responseTime,
      timestamp: Date.now(),
    });

    // Update metrics
    if (this.currentSession) {
      const session = this.sessions.get(this.currentSession);
      if (session) {
        if (error) {
          session.metrics.failedRequests++;
        }

        if (responseTime) {
          // Update average response time
          const totalTime =
            session.metrics.averageResponseTime *
            (session.metrics.totalRequests - 1);
          session.metrics.averageResponseTime =
            (totalTime + responseTime) / session.metrics.totalRequests;
        }
      }
    }
  }

  /**
   * Log validation step
   */
  logValidationStep(step: string, success: boolean, details?: unknown): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Validation ${step}: ${success ? "PASS" : "FAIL"}`;

    this.log(level, "Validation", message, details);
  }

  /**
   * Log adapter health check
   */
  logHealthCheck(adapter: string, health: string, details?: unknown): void {
    const level =
      health === "healthy"
        ? LogLevel.INFO
        : health === "degraded"
        ? LogLevel.WARN
        : LogLevel.ERROR;

    this.log(level, "Health", `Adapter ${adapter}: ${health}`, details);
  }

  /**
   * Export session logs as JSON
   */
  exportSession(sessionId?: string): string {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId || "current"}`);
    }

    return JSON.stringify(session, null, 2);
  }

  /**
   * Export session logs as formatted text
   */
  exportSessionText(sessionId?: string): string {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId || "current"}`);
    }

    const lines: string[] = [];

    lines.push(`=== Debug Session Report ===`);
    lines.push(`Session ID: ${session.sessionId}`);
    lines.push(`Adapter: ${session.adapter}`);
    lines.push(`Start Time: ${session.startTime.toISOString()}`);
    if (session.endTime) {
      lines.push(`End Time: ${session.endTime.toISOString()}`);
      lines.push(
        `Duration: ${session.endTime.getTime() - session.startTime.getTime()}ms`
      );
    }
    lines.push("");

    lines.push(`=== Metrics ===`);
    lines.push(`Total Requests: ${session.metrics.totalRequests}`);
    lines.push(`Failed Requests: ${session.metrics.failedRequests}`);
    lines.push(
      `Success Rate: ${
        session.metrics.totalRequests > 0
          ? (
              ((session.metrics.totalRequests -
                session.metrics.failedRequests) /
                session.metrics.totalRequests) *
              100
            ).toFixed(1)
          : 0
      }%`
    );
    lines.push(
      `Average Response Time: ${session.metrics.averageResponseTime.toFixed(
        1
      )}ms`
    );
    lines.push("");

    lines.push(`=== Feature Usage ===`);
    for (const [feature, count] of Object.entries(
      session.metrics.featureUsage
    )) {
      lines.push(`${feature}: ${count}`);
    }
    lines.push("");

    lines.push(`=== Log Entries ===`);
    for (const entry of session.logEntries) {
      const levelName = LogLevel[entry.level];
      lines.push(
        `[${entry.timestamp}] ${levelName} ${entry.component}: ${entry.message}`
      );

      if (entry.data) {
        lines.push(`  Data: ${JSON.stringify(entry.data, null, 2)}`);
      }

      if (entry.error) {
        lines.push(`  Error: ${entry.error.message}`);
        if (entry.error.stack) {
          lines.push(`  Stack: ${entry.error.stack}`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.log(
      LogLevel.INFO,
      "DebugLogger",
      `Log level set to: ${LogLevel[level]}`
    );
  }

  /**
   * Clear all sessions
   */
  clearSessions(): void {
    this.sessions.clear();
    this.currentSession = undefined;
    this.log(LogLevel.INFO, "DebugLogger", "All sessions cleared");
  }

  private logToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level].padEnd(5);
    const timestamp = entry.timestamp.split("T")[1].split(".")[0];
    const message = `[${timestamp}] ${levelName} ${entry.component}: ${entry.message}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message);
        if (entry.error) console.error(entry.error);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        debugLog(message);
        break;
    }

    if (entry.data && this.logLevel >= LogLevel.DEBUG) {
      console.log("  Data:", entry.data);
    }
  }

  private logToFile(entry: LogEntry): void {
    if (!this.logFile) return;

    const levelName = LogLevel[entry.level].padEnd(5);
    const line = `[${entry.timestamp}] ${levelName} ${entry.component}: ${entry.message}\n`;

    try {
      appendFileSync(this.logFile, line);

      if (entry.data && this.logLevel >= LogLevel.DEBUG) {
        appendFileSync(this.logFile, `  Data: ${JSON.stringify(entry.data)}\n`);
      }

      if (entry.error) {
        appendFileSync(this.logFile, `  Error: ${entry.error.message}\n`);
        if (entry.error.stack) {
          appendFileSync(this.logFile, `  Stack: ${entry.error.stack}\n`);
        }
      }
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  private ensureLogDirectoryExists(): void {
    if (!this.logFile) return;

    const dir = join(this.logFile, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// Export a default logger instance
export const debugLogger = new DebugLogger({
  logLevel: process.env.LSP_LOG_LEVEL
    ? parseInt(process.env.LSP_LOG_LEVEL)
    : LogLevel.INFO,
  enableConsoleLogging: true,
  enableFileLogging: false,
});
