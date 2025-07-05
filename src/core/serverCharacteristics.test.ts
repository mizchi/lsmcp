/**
 * Unit tests for server characteristics
 */

import { describe, it, expect } from "vitest";
import {
  getServerCharacteristics,
  mergeCharacteristics,
} from "./serverCharacteristics.ts";

describe("getServerCharacteristics", () => {
  it("should return default characteristics for unknown servers", () => {
    const characteristics = getServerCharacteristics("unknown");

    expect(characteristics).toEqual({
      documentOpenDelay: 1000,
      readinessCheckTimeout: 500,
      initialDiagnosticsTimeout: 2000,
      requiresProjectInit: false,
      sendsInitialDiagnostics: true,
      operationTimeout: 10000,
    });
  });

  it("should return TypeScript-specific characteristics", () => {
    const characteristics = getServerCharacteristics("typescript");

    expect(characteristics).toEqual({
      documentOpenDelay: 2000,
      readinessCheckTimeout: 1000,
      initialDiagnosticsTimeout: 3000,
      requiresProjectInit: true,
      sendsInitialDiagnostics: true,
      operationTimeout: 15000,
    });
  });

  it("should return TSGo-specific characteristics", () => {
    const characteristics = getServerCharacteristics("tsgo");

    expect(characteristics).toEqual({
      documentOpenDelay: 500,
      readinessCheckTimeout: 200,
      initialDiagnosticsTimeout: 1000,
      requiresProjectInit: false,
      sendsInitialDiagnostics: false,
      operationTimeout: 5000,
    });
  });

  it("should apply overrides to server characteristics", () => {
    const characteristics = getServerCharacteristics("typescript", {
      documentOpenDelay: 3000,
      operationTimeout: 20000,
    });

    expect(characteristics.documentOpenDelay).toBe(3000);
    expect(characteristics.operationTimeout).toBe(20000);
    // Other values should remain TypeScript defaults
    expect(characteristics.readinessCheckTimeout).toBe(1000);
    expect(characteristics.requiresProjectInit).toBe(true);
  });
});

describe("mergeCharacteristics", () => {
  it("should merge base and override characteristics", () => {
    const base = {
      documentOpenDelay: 1500,
      readinessCheckTimeout: 800,
    };

    const overrides = {
      documentOpenDelay: 2500,
      operationTimeout: 15000,
    };

    const merged = mergeCharacteristics(base, overrides);

    expect(merged).toEqual({
      documentOpenDelay: 2500, // overridden
      readinessCheckTimeout: 800, // from base
      initialDiagnosticsTimeout: 2000, // default
      requiresProjectInit: false, // default
      sendsInitialDiagnostics: true, // default
      operationTimeout: 15000, // overridden
    });
  });

  it("should return all defaults when no base or overrides provided", () => {
    const merged = mergeCharacteristics({});

    expect(merged).toEqual({
      documentOpenDelay: 1000,
      readinessCheckTimeout: 500,
      initialDiagnosticsTimeout: 2000,
      requiresProjectInit: false,
      sendsInitialDiagnostics: true,
      operationTimeout: 10000,
    });
  });
});
