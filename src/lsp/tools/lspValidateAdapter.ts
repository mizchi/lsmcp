import { z } from "zod";
import { err, type Result } from "neverthrow";
import { createLSPTool } from "../../core/io/toolFactory.ts";
// import { pyrightAdapter } from "../../adapters/pyright.ts";
// import { debugLogger, LogLevel } from "../debugLogger.ts";

const schema = z.object({
  root: z.string().describe("Root directory of the project"),
  adapter: z
    .string()
    .optional()
    .describe("Adapter to validate (default: current adapter)"),
  includeHealthCheck: z
    .boolean()
    .optional()
    .describe("Include health check (default: true)"),
  includeFeatureTest: z
    .boolean()
    .optional()
    .describe("Include feature tests (default: true)"),
});

type ValidateAdapterRequest = z.infer<typeof schema>;

interface ValidateAdapterSuccess {
  adapter: string;
  availability: {
    available: boolean;
    message?: string;
  };
  health?: {
    isHealthy: boolean;
    overallHealth: string;
    summary: string;
    connectionSuccess: boolean;
    initializationSuccess: boolean;
    workingFeatures: number;
    totalFeatures: number;
  };
  diagnosticInfo?: {
    supportedFeatures: string[];
    unsupportedFeatures: string[];
  };
  sessionId?: string;
}

/**
 * Validate LSP adapter functionality
 */
async function validateAdapter(
  _request: ValidateAdapterRequest,
): Promise<Result<ValidateAdapterSuccess, string>> {
  // Adapter validation is temporarily disabled
  return err("Adapter validation is temporarily disabled");

  /*
  try {
    debugLogger.log(
      LogLevel.INFO,
      "AdapterValidator",
      `Validating adapter for ${request.root}`,
    );

    // For now, only support pyright validation
    // TODO: Make this work with any adapter
    // const adapter = pyrightAdapter;

    const result: ValidateAdapterSuccess = {
      adapter: adapter.getConfig().id,
      availability: { available: false },
    };

    // Start debug session
    const sessionId = debugLogger.startSession(adapter.getConfig().id);
    result.sessionId = sessionId;

    try {
      // Step 1: Check availability
      debugLogger.log(
        LogLevel.DEBUG,
        "AdapterValidator",
        "Checking adapter availability",
      );

      result.availability = await adapter.checkAvailability();

      if (!result.availability.available) {
        debugLogger.log(
          LogLevel.WARN,
          "AdapterValidator",
          `Adapter not available: ${result.availability.message}`,
        );
        return ok(result);
      }

      // Step 2: Health check
      if (request.includeHealthCheck !== false) {
        debugLogger.log(
          LogLevel.DEBUG,
          "AdapterValidator",
          "Running health check",
        );

        const health = await adapter.getHealth(request.root);

        result.health = {
          isHealthy: health.isHealthy,
          overallHealth: health.validationResult.overallHealth,
          summary: health.validationResult.summary,
          connectionSuccess: health.validationResult.connectionSuccess,
          initializationSuccess: health.validationResult.initializationSuccess,
          workingFeatures: health.validationResult.featureTests.filter(
            (f: any) => f.working,
          ).length,
          totalFeatures: health.validationResult.featureTests.length,
        };
      }

      // Step 3: Diagnostic info
      debugLogger.log(
        LogLevel.DEBUG,
        "AdapterValidator",
        "Getting diagnostic info",
      );

      const diagnosticInfo = await adapter.getDiagnosticInfo(request.root);

      result.diagnosticInfo = {
        supportedFeatures: diagnosticInfo.supportedFeatures,
        unsupportedFeatures: diagnosticInfo.unsupportedFeatures,
      };

      debugLogger.log(
        LogLevel.INFO,
        "AdapterValidator",
        "Validation completed successfully",
      );

      return ok(result);
    } finally {
      // End debug session
      debugLogger.endSession(sessionId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLogger.log(
      LogLevel.ERROR,
      "AdapterValidator",
      `Validation failed: ${errorMessage}`,
      undefined,
      error instanceof Error ? error : undefined,
    );

    return err(`Adapter validation failed: ${errorMessage}`);
  }
  */
}

export const lspValidateAdapterTool = createLSPTool({
  name: "validate_adapter",
  description: "Validate LSP adapter functionality and health",
  schema,
  language: "lsp",
  handler: validateAdapter,
  formatSuccess: (result) => {
    const lines: string[] = [];

    lines.push(`=== Adapter Validation: ${result.adapter} ===`);

    // Availability
    lines.push(
      `\nAvailability: ${
        result.availability.available ? "✓ Available" : "✗ Not Available"
      }`,
    );
    if (result.availability.message) {
      lines.push(`Message: ${result.availability.message}`);
    }

    // Health check
    if (result.health) {
      lines.push(`\nHealth Check:`);
      lines.push(`  Overall Health: ${result.health.overallHealth}`);
      lines.push(
        `  Connection: ${result.health.connectionSuccess ? "✓" : "✗"}`,
      );
      lines.push(
        `  Initialization: ${result.health.initializationSuccess ? "✓" : "✗"}`,
      );
      lines.push(
        `  Working Features: ${result.health.workingFeatures}/${result.health.totalFeatures}`,
      );
      lines.push(`  Summary: ${result.health.summary}`);
    }

    // Diagnostic info
    if (result.diagnosticInfo) {
      lines.push(
        `\nSupported Features (${result.diagnosticInfo.supportedFeatures.length}):`,
      );
      result.diagnosticInfo.supportedFeatures.forEach((feature) => {
        lines.push(`  ✓ ${feature}`);
      });

      if (result.diagnosticInfo.unsupportedFeatures.length > 0) {
        lines.push(
          `\nUnsupported Features (${result.diagnosticInfo.unsupportedFeatures.length}):`,
        );
        result.diagnosticInfo.unsupportedFeatures.forEach((feature) => {
          lines.push(`  ✗ ${feature}`);
        });
      }
    }

    if (result.sessionId) {
      lines.push(`\nDebug Session: ${result.sessionId}`);
      lines.push(`Use export_debug_session to get detailed logs.`);
    }

    return lines.join("\n");
  },
});
