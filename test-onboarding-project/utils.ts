export interface Config {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
}

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export function log(level: LogLevel, message: string): void {
  console.log("[" + level + "] " + message);
}
