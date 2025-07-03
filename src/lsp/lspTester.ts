import { AdapterManager } from "./lspAdapterUtils.ts";
import { LSPValidationResult } from "./lspValidator.ts";
import { debugLog } from "../mcp/utils/errorHandler.ts";

export interface TestSuite {
  name: string;
  adapter: AdapterManager;
  rootPath: string;
  testCases: TestCase[];
}

export interface TestCase {
  name: string;
  description: string;
  testContent: string;
  fileName: string;
  expectations: TestExpectation[];
}

export interface TestExpectation {
  feature: string;
  shouldWork: boolean;
  position?: { line: number; character: number };
  expectedResult?: unknown;
  timeout?: number;
}

export interface TestResult {
  testCase: string;
  feature: string;
  passed: boolean;
  error?: string;
  actualResult?: unknown;
  responseTime?: number;
}

export interface TestSuiteResult {
  suiteName: string;
  adapter: string;
  validationResult: LSPValidationResult;
  testResults: TestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    successRate: number;
  };
}

export class LSPTester {
  /**
   * Run a complete test suite for an LSP adapter
   */
  async runTestSuite(suite: TestSuite): Promise<TestSuiteResult> {
    debugLog(`Running test suite: ${suite.name}`);

    const testResults: TestResult[] = [];

    // First, run the basic validation
    const validationResult = await suite.adapter.validate(suite.rootPath);

    if (!validationResult.connectionSuccess) {
      debugLog(`Test suite ${suite.name} failed: No LSP connection`);
      return this.createFailedSuiteResult(
        suite,
        validationResult,
        "No LSP connection",
      );
    }

    // Run individual test cases
    for (const testCase of suite.testCases) {
      debugLog(`Running test case: ${testCase.name}`);

      const caseResults = await this.runTestCase(
        suite.adapter,
        suite.rootPath,
        testCase,
      );
      testResults.push(...caseResults);
    }

    // Calculate summary
    const summary = this.calculateSummary(testResults);

    return {
      suiteName: suite.name,
      adapter: suite.adapter.config.id,
      validationResult,
      testResults,
      summary,
    };
  }

  /**
   * Run a single test case
   */
  private async runTestCase(
    adapter: AdapterManager,
    rootPath: string,
    testCase: TestCase,
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const expectation of testCase.expectations) {
      const result = await this.runTestExpectation(
        adapter,
        rootPath,
        testCase,
        expectation,
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Run a single test expectation
   */
  private async runTestExpectation(
    adapter: AdapterManager,
    rootPath: string,
    testCase: TestCase,
    expectation: TestExpectation,
  ): Promise<TestResult> {
    const result: TestResult = {
      testCase: testCase.name,
      feature: expectation.feature,
      passed: false,
    };

    try {
      // Create a temporary validation to test the specific feature
      const validationResult = await adapter.validate(rootPath, {
        testFileContent: testCase.testContent,
        testFileName: testCase.fileName,
        timeout: expectation.timeout || 5000,
      });

      // Find the feature test result
      const featureResult = validationResult.featureTests.find(
        (test) => test.feature === expectation.feature,
      );

      if (!featureResult) {
        result.error = `Feature ${expectation.feature} not tested`;
        return result;
      }

      // Check if the result matches expectation
      if (expectation.shouldWork) {
        result.passed = featureResult.working;
        if (!result.passed) {
          result.error =
            featureResult.error || "Feature expected to work but didn't";
        }
      } else {
        result.passed = !featureResult.working;
        if (!result.passed) {
          result.error = "Feature expected to fail but worked";
        }
      }

      result.responseTime = featureResult.responseTime;
      result.actualResult = featureResult;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.passed = !expectation.shouldWork; // If we expected failure, error is success
    }

    return result;
  }

  /**
   * Create a failed test suite result
   */
  private createFailedSuiteResult(
    suite: TestSuite,
    validationResult: LSPValidationResult,
    _reason: string,
  ): TestSuiteResult {
    const totalTests = suite.testCases.reduce(
      (sum, testCase) => sum + testCase.expectations.length,
      0,
    );

    return {
      suiteName: suite.name,
      adapter: suite.adapter.config.id,
      validationResult,
      testResults: [],
      summary: {
        totalTests,
        passedTests: 0,
        failedTests: totalTests,
        successRate: 0,
      },
    };
  }

  /**
   * Calculate test summary
   */
  private calculateSummary(
    testResults: TestResult[],
  ): TestSuiteResult["summary"] {
    const totalTests = testResults.length;
    const passedTests = testResults.filter((result) => result.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Generate a human-readable test report
   */
  generateReport(result: TestSuiteResult): string {
    const lines: string[] = [];

    lines.push(`=== LSP Test Report ===`);
    lines.push(`Suite: ${result.suiteName}`);
    lines.push(`Adapter: ${result.adapter}`);
    lines.push(`Overall Health: ${result.validationResult.overallHealth}`);
    lines.push(
      `Connection: ${
        result.validationResult.connectionSuccess ? "OK" : "FAILED"
      }`,
    );
    lines.push(
      `Initialization: ${
        result.validationResult.initializationSuccess ? "OK" : "FAILED"
      }`,
    );
    lines.push("");

    lines.push(
      `Test Results: ${result.summary.passedTests}/${result.summary.totalTests} passed (${result.summary.successRate}%)`,
    );
    lines.push("");

    // Group results by test case
    const resultsByTestCase = result.testResults.reduce(
      (acc, testResult) => {
        if (!acc[testResult.testCase]) {
          acc[testResult.testCase] = [];
        }
        acc[testResult.testCase].push(testResult);
        return acc;
      },
      {} as Record<string, TestResult[]>,
    );

    for (const [testCase, testResults] of Object.entries(resultsByTestCase)) {
      lines.push(`Test Case: ${testCase}`);

      for (const testResult of testResults) {
        const status = testResult.passed ? "✓" : "✗";
        const time = testResult.responseTime
          ? ` (${testResult.responseTime}ms)`
          : "";
        lines.push(`  ${status} ${testResult.feature}${time}`);

        if (testResult.error) {
          lines.push(`    Error: ${testResult.error}`);
        }
      }

      lines.push("");
    }

    // Feature validation summary
    lines.push("Feature Validation:");
    for (const feature of result.validationResult.featureTests) {
      const status = feature.working ? "✓" : "✗";
      const time = feature.responseTime ? ` (${feature.responseTime}ms)` : "";
      lines.push(`  ${status} ${feature.feature}${time}`);

      if (feature.error) {
        lines.push(`    Error: ${feature.error}`);
      }
    }

    return lines.join("\n");
  }
}

// Export a default instance
export const lspTester = new LSPTester();
