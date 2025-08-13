/**
 * LSP Protocol types aggregation
 */

// Re-export base types
export * from "./base.ts";

// Re-export request types
export * from "./requests.ts";

// Re-export response types
export * from "./responses.ts";

// Re-export notification types
export * from "./notifications.ts";

// Re-export client types from @lsmcp/types
export type {
  LSPClient,
  LSPClientConfig,
  LSPClientState,
  HoverContents,
} from "@lsmcp/types";
