import { describe, it, expect, vi } from "vitest";
import type { ChildProcess } from "child_process";
import { ConnectionHandler } from "./connection.ts";
import { createInitialState, type LSPProcessState } from "./state.ts";

/** A state whose process records everything the client writes to stdin. */
function createState() {
  const written: Array<Record<string, unknown>> = [];
  const process = {
    stdin: {
      write(chunk: string) {
        written.push(JSON.parse(chunk.slice(chunk.indexOf("\r\n\r\n") + 4)));
        return true;
      },
    },
  } as unknown as ChildProcess;
  const state = createInitialState({
    process,
    rootPath: "/project",
    languageId: "typescript",
  });
  return { state, written };
}

function deliver(state: LSPProcessState, message: Record<string, unknown>) {
  const body = JSON.stringify(message);
  const frame = Buffer.from(
    `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  );
  state.chunks.push(frame);
  state.bufferedBytes += frame.length;
}

describe("ConnectionHandler server-to-client requests", () => {
  it("accepts a didChangeConfiguration registration", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: "ts1",
      method: "client/registerCapability",
      params: {
        registrations: [
          { id: "cfg", method: "workspace/didChangeConfiguration" },
        ],
      },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([{ jsonrpc: "2.0", id: "ts1", result: null }]);
  });

  it("rejects a registration it cannot honour instead of faking success", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: "ts2",
      method: "client/registerCapability",
      params: {
        registrations: [
          { id: "cfg", method: "workspace/didChangeConfiguration" },
          { id: "watch", method: "workspace/didChangeWatchedFiles" },
        ],
      },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([
      {
        jsonrpc: "2.0",
        id: "ts2",
        error: {
          code: -32602,
          message:
            "Cannot honour registration of: workspace/didChangeWatchedFiles",
        },
      },
    ]);
  });

  it("acknowledges window/workDoneProgress/create", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: 7,
      method: "window/workDoneProgress/create",
      params: { token: "t" },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([{ jsonrpc: "2.0", id: 7, result: null }]);
  });

  it("answers workspace/configuration with one entry per item", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: 3,
      method: "workspace/configuration",
      params: { items: [{ section: "typescript" }, { section: "deno" }] },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([
      {
        jsonrpc: "2.0",
        id: 3,
        result: [{}, { enable: true, lint: true, unstable: true }],
      },
    ]);
  });

  it("rejects unknown server requests instead of leaving them pending", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: 4,
      method: "window/showMessageRequest",
      params: { message: "?" },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([
      {
        jsonrpc: "2.0",
        id: 4,
        error: {
          code: -32601,
          message: "Method not found: window/showMessageRequest",
        },
      },
    ]);
  });

  it("does not answer notifications", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri: "file:///project/a.ts", diagnostics: [] },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([]);
    expect(state.diagnostics.get("file:///project/a.ts")).toEqual([]);
  });
  it("frames by byte length so multibyte text does not desync the stream", () => {
    // tsc --lsp logs timings like "528.041µs"; µ is 2 bytes but 1 character
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      method: "window/logMessage",
      params: { type: 3, message: "handled in 528.041µs" },
    });
    deliver(state, {
      jsonrpc: "2.0",
      id: 9,
      method: "window/workDoneProgress/create",
      params: { token: "t" },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([{ jsonrpc: "2.0", id: 9, result: null }]);
    expect(state.bufferedBytes).toBe(0);
  });
  it("reassembles a frame whose multibyte character is split across chunks", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: 11,
      method: "window/workDoneProgress/create",
      params: { token: "µ" },
    });
    const [frame] = state.chunks;
    const cut = frame.indexOf(Buffer.from("µ")) + 1; // inside the 2-byte µ
    state.chunks = [frame.subarray(0, cut)];
    state.bufferedBytes = cut;
    const handler = new ConnectionHandler(state);
    handler.processBuffer();
    expect(written).toEqual([]);

    state.chunks.push(frame.subarray(cut));
    state.bufferedBytes += frame.length - cut;
    handler.processBuffer();

    expect(written).toEqual([{ jsonrpc: "2.0", id: 11, result: null }]);
  });

  describe("workspace/applyEdit", () => {
    const request = {
      jsonrpc: "2.0",
      id: 20,
      method: "workspace/applyEdit",
      params: { edit: { changes: {} } },
    };

    it("answers with the handler's result", async () => {
      const { state, written } = createState();
      deliver(state, request);
      new ConnectionHandler(state, {
        applyEdit: async () => ({ applied: true }),
      }).processBuffer();

      await vi.waitFor(() => expect(written).toHaveLength(1));
      expect(written).toEqual([
        { jsonrpc: "2.0", id: 20, result: { applied: true } },
      ]);
    });

    it("turns a throwing handler into an InternalError response", async () => {
      const { state, written } = createState();
      deliver(state, request);
      new ConnectionHandler(state, {
        applyEdit: async () => {
          throw new Error("disk on fire");
        },
      }).processBuffer();

      await vi.waitFor(() => expect(written).toHaveLength(1));
      expect(written).toEqual([
        {
          jsonrpc: "2.0",
          id: 20,
          error: { code: -32603, message: "disk on fire" },
        },
      ]);
    });

    it("is MethodNotFound without a handler", () => {
      const { state, written } = createState();
      deliver(state, request);
      new ConnectionHandler(state).processBuffer();

      expect(written).toEqual([
        {
          jsonrpc: "2.0",
          id: 20,
          error: {
            code: -32601,
            message: "Method not found: workspace/applyEdit",
          },
        },
      ]);
    });

    it("rejects a request without params.edit instead of leaving it unanswered", () => {
      const { state, written } = createState();
      deliver(state, { ...request, params: {} });
      new ConnectionHandler(state, {
        applyEdit: async () => ({ applied: true }),
      }).processBuffer();

      expect(written).toEqual([
        {
          jsonrpc: "2.0",
          id: 20,
          error: {
            code: -32602,
            message: "workspace/applyEdit: params.edit is required",
          },
        },
      ]);
    });

    it("keeps serving later requests after a response could not be sent", async () => {
      const { state, written } = createState();
      const stdin = state.process!.stdin as unknown as {
        write: (chunk: string) => boolean;
      };
      const realWrite = stdin.write;
      let failOnce = true;
      stdin.write = (chunk: string) => {
        if (failOnce) {
          failOnce = false;
          throw new Error("EPIPE");
        }
        return realWrite(chunk);
      };
      const handled: number[] = [];
      deliver(state, { ...request, id: 31 });
      deliver(state, { ...request, id: 32 });
      new ConnectionHandler(state, {
        applyEdit: async () => {
          handled.push(handled.length + 1);
          return { applied: true };
        },
      }).processBuffer();

      await vi.waitFor(() => expect(written).toHaveLength(1));
      expect(handled).toEqual([1, 2]);
      expect(written).toEqual([
        { jsonrpc: "2.0", id: 32, result: { applied: true } },
      ]);
    });

    it("applies requests one at a time in arrival order", async () => {
      const { state, written } = createState();
      const order: string[] = [];
      deliver(state, {
        ...request,
        id: 21,
        params: { edit: { changes: {}, label: "a" } },
      });
      deliver(state, {
        ...request,
        id: 22,
        params: { edit: { changes: {}, label: "b" } },
      });
      new ConnectionHandler(state, {
        applyEdit: async (edit) => {
          const label = (edit as { label?: string }).label ?? "";
          order.push("start " + label);
          await new Promise((r) => setTimeout(r, label === "a" ? 30 : 0));
          order.push("end " + label);
          return { applied: true };
        },
      }).processBuffer();

      await vi.waitFor(() => expect(written).toHaveLength(2));
      expect(order).toEqual(["start a", "end a", "start b", "end b"]);
      expect(written.map((w) => w.id)).toEqual([21, 22]);
    });
  });
});

describe("ConnectionHandler.sendRequest", () => {
  it("rejects without registering a handler or timer when there is no process", async () => {
    vi.useFakeTimers();
    try {
      const { state } = createState();
      state.process = null;
      const connection = new ConnectionHandler(state);

      await expect(connection.sendRequest("initialize")).rejects.toThrow(
        "LSP server not started",
      );
      expect(state.responseHandlers.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ConnectionHandler.rejectPendingRequests", () => {
  it("fails every waiting request and clears its timer", async () => {
    vi.useFakeTimers();
    try {
      const { state } = createState();
      const connection = new ConnectionHandler(state);
      const initialize = connection.sendRequest("initialize");
      const hover = connection.sendRequest("textDocument/hover");

      connection.rejectPendingRequests(new Error("server exited"));

      await expect(initialize).rejects.toThrow("server exited");
      await expect(hover).rejects.toThrow("server exited");
      expect(state.responseHandlers.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
