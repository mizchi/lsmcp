import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";
import { ConnectionHandler } from "./connection.ts";
import { LifecycleManager } from "./lifecycle.ts";
import { createInitialState } from "./state.ts";

/** A child process whose stdio are plain emitters and that never really runs */
function fakeProcess() {
  return Object.assign(new EventEmitter(), {
    stdin: { write: () => true },
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    killed: false,
    kill() {
      this.killed = true;
      return true;
    },
  }) as unknown as ChildProcess & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
}

function frame(message: Record<string, unknown>): Buffer {
  const body = JSON.stringify(message);
  return Buffer.from(
    `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  );
}

function createLifecycle() {
  const process = fakeProcess();
  const config = { process, rootPath: "/project", languageId: "typescript" };
  const state = createInitialState(config);
  const connection = new ConnectionHandler(state);
  const lifecycle = new LifecycleManager(state, connection, config);
  return { process, state, connection, lifecycle };
}

describe("LifecycleManager on server exit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fails the pending initialize when the server exits during start", async () => {
    const { process, state, lifecycle } = createLifecycle();

    const started = lifecycle.start();
    process.stderr.emit("data", Buffer.from("Unknown compiler option '--lsp'"));
    process.emit("exit", 1);

    await expect(started).rejects.toThrow(
      "exited (code 1) before answering initialize\nStderr output:\nUnknown compiler option '--lsp'",
    );
    expect(state.responseHandlers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails start when the server exits with code 0 before answering initialize", async () => {
    const { process, state, lifecycle } = createLifecycle();

    const started = lifecycle.start();
    process.emit("exit", 0);

    await expect(started).rejects.toThrow(
      "exited (code 0) before answering initialize",
    );
    expect(state.serverCapabilities).toBeUndefined();
    expect(state.responseHandlers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops without throwing when the server exits while shutdown is pending", async () => {
    const { process, state, lifecycle } = createLifecycle();

    const started = lifecycle.start();
    process.stdout.emit(
      "data",
      frame({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }),
    );
    await vi.runAllTimersAsync();
    await started;

    const stopped = lifecycle.stop();
    process.emit("exit", 0);
    await vi.advanceTimersByTimeAsync(100);

    await expect(stopped).resolves.toBeUndefined();
    expect(state.process).toBeNull();
  });

  it("fails requests in flight when the server exits after start", async () => {
    const { process, state, connection, lifecycle } = createLifecycle();

    const started = lifecycle.start();
    process.stdout.emit(
      "data",
      frame({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }),
    );
    await vi.runAllTimersAsync();
    await started;

    const hover = connection.sendRequest("textDocument/hover", {});
    process.emit("exit", 0);

    await expect(hover).rejects.toThrow("exited (code 0)");
    expect(state.responseHandlers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
