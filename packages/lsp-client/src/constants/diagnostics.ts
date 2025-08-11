/**
 * Diagnostics-related constants
 */

// Batch processing
export const DIAGNOSTICS_BATCH_SIZE = 5; // Files to process in parallel
export const DIAGNOSTICS_POLL_INTERVAL = 50; // ms
export const DIAGNOSTICS_MAX_POLLS = 100;
export const DIAGNOSTICS_DEFAULT_TIMEOUT = 5000; // ms

// Display limits
export const MAX_FILES_TO_SHOW = 20;
export const MAX_DIAGNOSTICS_PER_FILE = 10;

// Language-specific timeouts
export const LANGUAGE_SPECIFIC_TIMEOUTS = {
  moonbit: { initialWait: 1000, maxPolls: 200, timeout: 5000 },
  deno: { initialWait: 800, maxPolls: 100, timeout: 3000 },
  default: { initialWait: 200, maxPolls: 60, timeout: 1000 },
  largeFile: { initialWait: 500, maxPolls: 100, timeout: 3000 },
} as const;
