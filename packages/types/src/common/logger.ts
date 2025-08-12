/**
 * Common logging types and constants
 */

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
    totalResponseTime: number;
    avgResponseTime?: number;
  };
}