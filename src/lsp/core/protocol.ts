/**
 * LSP protocol message processing utilities
 */

import { getErrorMessage } from "../../core/pure/types.ts";

interface ProcessedMessage {
  headers: Record<string, string>;
  body: unknown;
  remainingBuffer: string;
}

/**
 * Process LSP message buffer and extract complete messages
 */
export function processBuffer(buffer: string): {
  messages: ProcessedMessage[];
  remainingBuffer: string;
} {
  const messages: ProcessedMessage[] = [];
  let currentBuffer = buffer;

  while (true) {
    const result = extractNextMessage(currentBuffer);
    if (!result) {
      break;
    }

    messages.push({
      headers: result.headers,
      body: result.body,
      remainingBuffer: "",
    });
    currentBuffer = result.remainingBuffer;
  }

  return { messages, remainingBuffer: currentBuffer };
}

/**
 * Extract next complete message from buffer
 */
function extractNextMessage(buffer: string): {
  headers: Record<string, string>;
  body: unknown;
  remainingBuffer: string;
} | null {
  // Look for the header/body separator
  const headerEndIndex = buffer.indexOf("\r\n\r\n");
  if (headerEndIndex === -1) {
    return null; // Incomplete headers
  }

  // Parse headers
  const headerText = buffer.substring(0, headerEndIndex);
  const headers: Record<string, string> = {};
  const headerLines = headerText.split("\r\n");

  for (const line of headerLines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const name = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      headers[name] = value;
    }
  }

  // Check for Content-Length header
  const contentLength = headers["Content-Length"];
  if (!contentLength) {
    throw new Error("Missing Content-Length header");
  }

  const bodyLength = parseInt(contentLength, 10);
  const bodyStartIndex = headerEndIndex + 4; // Skip \r\n\r\n
  const bodyEndIndex = bodyStartIndex + bodyLength;

  // Check if we have the complete body
  if (buffer.length < bodyEndIndex) {
    return null; // Incomplete body
  }

  // Extract body
  const bodyText = buffer.substring(bodyStartIndex, bodyEndIndex);
  let body: unknown;

  try {
    body = JSON.parse(bodyText);
  } catch (e) {
    throw new Error(`Failed to parse message body: ${getErrorMessage(e)}`);
  }

  return {
    headers,
    body,
    remainingBuffer: buffer.substring(bodyEndIndex),
  };
}

/**
 * Format a message for sending over LSP protocol
 */
export function formatMessage(message: unknown): string {
  const json = JSON.stringify(message);
  const contentLength = Buffer.byteLength(json, "utf8");
  return `Content-Length: ${contentLength}\r\n\r\n${json}`;
}
