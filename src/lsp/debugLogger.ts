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

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  error?: Error;
}

interface DebugSession {
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

interface DebugLoggerState {
  logLevel: LogLevel;
  logFile?: string;
  sessions: Map<string, DebugSession>;
  currentSession?: string;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
}

/**
 * Create a new debug logger state
 */
export function createDebugLogger(options?: {
  logLevel?: LogLevel;
  logFile?: string;
  enableFileLogging?: boolean;
  enableConsoleLogging?: boolean;
}): DebugLoggerState {
  const state: DebugLoggerState = {
    logLevel: options?.logLevel ?? LogLevel.INFO,
    logFile: options?.logFile,
    sessions: new Map(),
    currentSession: undefined,
    enableFileLogging: options?.enableFileLogging ?? false,
    enableConsoleLogging: options?.enableConsoleLogging ?? true,
  };

  if (options?.logFile) {
    state.enableFileLogging = true;
    ensureLogDirectoryExists(options.logFile);
  }

  return state;
}

/**
 * Start a new debug session
 */
export function startSession(
  state: DebugLoggerState,
  adapter: string,
  sessionId?: string,
): string {
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

  state.sessions.set(id, session);
  state.currentSession = id;

  log(
    state,
    LogLevel.INFO,
    "DebugLogger",
    `Started debug session: ${id} for adapter: ${adapter}`,
  );

  return id;
}

/**
 * End the current debug session
 */
export function endSession(
  state: DebugLoggerState,
  sessionId?: string,
): DebugSession | undefined {
  const id = sessionId || state.currentSession;
  if (!id) return undefined;

  const session = state.sessions.get(id);
  if (!session) return undefined;

  session.endTime = new Date();
  log(state, LogLevel.INFO, "DebugLogger", `Ended debug session: ${id}`);

  if (state.currentSession === id) {
    state.currentSession = undefined;
  }

  return session;
}

/**
 * Get a debug session
 */
export function getSession(
  state: DebugLoggerState,
  sessionId?: string,
): DebugSession | undefined {
  const id = sessionId || state.currentSession;
  return id ? state.sessions.get(id) : undefined;
}

/**
 * Log a message
 */
export function log(
  state: DebugLoggerState,
  level: LogLevel,
  component: string,
  message: string,
  data?: unknown,
  error?: Error,
): void {
  if (level > state.logLevel) {
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
  if (state.currentSession) {
    const session = state.sessions.get(state.currentSession);
    if (session) {
      session.logEntries.push(entry);
    }
  }

  // Output to console if enabled
  if (state.enableConsoleLogging) {
    logToConsole(entry, state.logLevel);
  }

  // Output to file if enabled
  if (state.enableFileLogging && state.logFile) {
    logToFile(entry, state.logFile, state.logLevel);
  }
}

/**
 * Log LSP request/response
 */
export function logLSPRequest(
  state: DebugLoggerState,
  method: string,
  params?: unknown,
  requestId?: string | number,
): void {
  log(state, LogLevel.DEBUG, "LSP-Request", `${method}`, {
    method,
    params,
    requestId,
    timestamp: Date.now(),
  });

  // Update metrics
  if (state.currentSession) {
    const session = state.sessions.get(state.currentSession);
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
export function logLSPResponse(
  state: DebugLoggerState,
  method: string,
  result?: unknown,
  error?: unknown,
  requestId?: string | number,
  responseTime?: number,
): void {
  const level = error ? LogLevel.ERROR : LogLevel.DEBUG;
  const message = error ? `${method} - ERROR` : `${method} - OK`;

  log(state, level, "LSP-Response", message, {
    method,
    result,
    error,
    requestId,
    responseTime,
    timestamp: Date.now(),
  });

  // Update metrics
  if (state.currentSession) {
    const session = state.sessions.get(state.currentSession);
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
export function logValidationStep(
  state: DebugLoggerState,
  step: string,
  success: boolean,
  details?: unknown,
): void {
  const level = success ? LogLevel.INFO : LogLevel.ERROR;
  const message = `Validation ${step}: ${success ? "PASS" : "FAIL"}`;

  log(state, level, "Validation", message, details);
}

/**
 * Log adapter health check
 */
export function logHealthCheck(
  state: DebugLoggerState,
  adapter: string,
  health: string,
  details?: unknown,
): void {
  const level =
    health === "healthy"
      ? LogLevel.INFO
      : health === "degraded"
        ? LogLevel.WARN
        : LogLevel.ERROR;

  log(state, level, "Health", `Adapter ${adapter}: ${health}`, details);
}

/**
 * Export session logs as JSON
 */
export function exportSession(
  state: DebugLoggerState,
  sessionId?: string,
): string {
  const session = getSession(state, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId || "current"}`);
  }

  return JSON.stringify(session, null, 2);
}

/**
 * Export session logs as formatted text
 */
export function exportSessionText(
  state: DebugLoggerState,
  sessionId?: string,
): string {
  const session = getSession(state, sessionId);
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
      `Duration: ${session.endTime.getTime() - session.startTime.getTime()}ms`,
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
            ((session.metrics.totalRequests - session.metrics.failedRequests) /
              session.metrics.totalRequests) *
            100
          ).toFixed(1)
        : 0
    }%`,
  );
  lines.push(
    `Average Response Time: ${session.metrics.averageResponseTime.toFixed(
      1,
    )}ms`,
  );
  lines.push("");

  lines.push(`=== Feature Usage ===`);
  for (const [feature, count] of Object.entries(session.metrics.featureUsage)) {
    lines.push(`${feature}: ${count}`);
  }
  lines.push("");

  lines.push(`=== Log Entries ===`);
  for (const entry of session.logEntries) {
    const levelName = LogLevel[entry.level];
    lines.push(
      `[${entry.timestamp}] ${levelName} ${entry.component}: ${entry.message}`,
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
export function setLogLevel(state: DebugLoggerState, level: LogLevel): void {
  state.logLevel = level;
  log(
    state,
    LogLevel.INFO,
    "DebugLogger",
    `Log level set to: ${LogLevel[level]}`,
  );
}

/**
 * Clear all sessions
 */
export function clearSessions(state: DebugLoggerState): void {
  state.sessions.clear();
  state.currentSession = undefined;
  log(state, LogLevel.INFO, "DebugLogger", "All sessions cleared");
}

function logToConsole(entry: LogEntry, logLevel: LogLevel): void {
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

  if (entry.data && logLevel >= LogLevel.DEBUG) {
    console.log("  Data:", entry.data);
  }
}

function logToFile(entry: LogEntry, logFile: string, logLevel: LogLevel): void {
  const levelName = LogLevel[entry.level].padEnd(5);
  const line = `[${entry.timestamp}] ${levelName} ${entry.component}: ${entry.message}\n`;

  try {
    appendFileSync(logFile, line);

    if (entry.data && logLevel >= LogLevel.DEBUG) {
      appendFileSync(logFile, `  Data: ${JSON.stringify(entry.data)}\n`);
    }

    if (entry.error) {
      appendFileSync(logFile, `  Error: ${entry.error.message}\n`);
      if (entry.error.stack) {
        appendFileSync(logFile, `  Stack: ${entry.error.stack}\n`);
      }
    }
  } catch (error) {
    console.error("Failed to write to log file:", error);
  }
}

function ensureLogDirectoryExists(logFile: string): void {
  const dir = join(logFile, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Export a default logger instance
export const debugLogger = createDebugLogger({
  logLevel: process.env.LSP_LOG_LEVEL
    ? parseInt(process.env.LSP_LOG_LEVEL)
    : LogLevel.INFO,
  enableConsoleLogging: true,
  enableFileLogging: false,
});

// Export convenience functions that use the default logger
export const defaultStartSession = (adapter: string, sessionId?: string) =>
  startSession(debugLogger, adapter, sessionId);
export const defaultEndSession = (sessionId?: string) =>
  endSession(debugLogger, sessionId);
export const defaultGetSession = (sessionId?: string) =>
  getSession(debugLogger, sessionId);
export const defaultLog = (
  level: LogLevel,
  component: string,
  message: string,
  data?: unknown,
  error?: Error,
) => log(debugLogger, level, component, message, data, error);
export const defaultLogLSPRequest = (
  method: string,
  params?: unknown,
  requestId?: string | number,
) => logLSPRequest(debugLogger, method, params, requestId);
export const defaultLogLSPResponse = (
  method: string,
  result?: unknown,
  error?: unknown,
  requestId?: string | number,
  responseTime?: number,
) =>
  logLSPResponse(debugLogger, method, result, error, requestId, responseTime);
export const defaultLogValidationStep = (
  step: string,
  success: boolean,
  details?: unknown,
) => logValidationStep(debugLogger, step, success, details);
export const defaultLogHealthCheck = (
  adapter: string,
  health: string,
  details?: unknown,
) => logHealthCheck(debugLogger, adapter, health, details);
export const defaultExportSession = (sessionId?: string) =>
  exportSession(debugLogger, sessionId);
export const defaultExportSessionText = (sessionId?: string) =>
  exportSessionText(debugLogger, sessionId);
export const defaultSetLogLevel = (level: LogLevel) =>
  setLogLevel(debugLogger, level);
export const defaultClearSessions = () => clearSessions(debugLogger);
