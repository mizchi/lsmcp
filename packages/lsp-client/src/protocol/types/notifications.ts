/**
 * LSP Notification types
 */

import { DocumentUri, Diagnostic } from "@internal/types";

// Diagnostic notifications
export interface PublishDiagnosticsParams {
  uri: DocumentUri;
  diagnostics: Diagnostic[];
}

// Window notifications
export interface ShowMessageParams {
  type: MessageType;
  message: string;
}

export enum MessageType {
  Error = 1,
  Warning = 2,
  Info = 3,
  Log = 4,
}

export interface LogMessageParams {
  type: MessageType;
  message: string;
}

// Progress notifications
export interface ProgressParams<T = unknown> {
  token: number | string;
  value: T;
}

export interface WorkDoneProgressBegin {
  kind: "begin";
  title: string;
  cancellable?: boolean;
  message?: string;
  percentage?: number;
}

export interface WorkDoneProgressReport {
  kind: "report";
  cancellable?: boolean;
  message?: string;
  percentage?: number;
}

export interface WorkDoneProgressEnd {
  kind: "end";
  message?: string;
}

export type WorkDoneProgress =
  | WorkDoneProgressBegin
  | WorkDoneProgressReport
  | WorkDoneProgressEnd;

// Type guards
export function isPublishDiagnosticsParams(
  params: any,
): params is PublishDiagnosticsParams {
  return (
    params &&
    typeof params === "object" &&
    "uri" in params &&
    "diagnostics" in params &&
    Array.isArray(params.diagnostics)
  );
}
