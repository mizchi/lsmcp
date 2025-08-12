/**
 * Dependency injection container for LSP client
 */

import type {
  ILogger,
  IErrorHandler,
  IFileSystem,
  ILanguageDetector,
  ILineResolver,
  IServerCharacteristicsProvider,
} from "./interfaces.ts";

import {
  DefaultLogger,
  DefaultErrorHandler,
  DefaultLanguageDetector,
  DefaultLineResolver,
  DefaultServerCharacteristicsProvider,
} from "./utils/defaults.ts";

export interface IDependencyContainer {
  logger: ILogger;
  errorHandler: IErrorHandler;
  fileSystem?: IFileSystem;
  languageDetector: ILanguageDetector;
  lineResolver: ILineResolver;
  serverCharacteristicsProvider: IServerCharacteristicsProvider;
}

class DependencyContainer implements IDependencyContainer {
  private _logger: ILogger = new DefaultLogger();
  private _errorHandler: IErrorHandler = new DefaultErrorHandler();
  private _fileSystem?: IFileSystem;
  private _languageDetector: ILanguageDetector = new DefaultLanguageDetector();
  private _lineResolver: ILineResolver = new DefaultLineResolver();
  private _serverCharacteristicsProvider: IServerCharacteristicsProvider =
    new DefaultServerCharacteristicsProvider();

  get logger(): ILogger {
    return this._logger;
  }

  set logger(value: ILogger) {
    this._logger = value;
  }

  get errorHandler(): IErrorHandler {
    return this._errorHandler;
  }

  set errorHandler(value: IErrorHandler) {
    this._errorHandler = value;
  }

  get fileSystem(): IFileSystem | undefined {
    return this._fileSystem;
  }

  set fileSystem(value: IFileSystem | undefined) {
    this._fileSystem = value;
  }

  get languageDetector(): ILanguageDetector {
    return this._languageDetector;
  }

  set languageDetector(value: ILanguageDetector) {
    this._languageDetector = value;
  }

  get lineResolver(): ILineResolver {
    return this._lineResolver;
  }

  set lineResolver(value: ILineResolver) {
    this._lineResolver = value;
  }

  get serverCharacteristicsProvider(): IServerCharacteristicsProvider {
    return this._serverCharacteristicsProvider;
  }

  set serverCharacteristicsProvider(value: IServerCharacteristicsProvider) {
    this._serverCharacteristicsProvider = value;
  }

  /**
   * Configure the container with custom implementations
   */
  configure(config: Partial<IDependencyContainer>): void {
    if (config.logger) this.logger = config.logger;
    if (config.errorHandler) this.errorHandler = config.errorHandler;
    if (config.fileSystem) this.fileSystem = config.fileSystem;
    if (config.languageDetector)
      this.languageDetector = config.languageDetector;
    if (config.lineResolver) this.lineResolver = config.lineResolver;
    if (config.serverCharacteristicsProvider) {
      this.serverCharacteristicsProvider = config.serverCharacteristicsProvider;
    }
  }

  /**
   * Reset to default implementations
   */
  reset(): void {
    this._logger = new DefaultLogger();
    this._errorHandler = new DefaultErrorHandler();
    this._fileSystem = undefined;
    this._languageDetector = new DefaultLanguageDetector();
    this._lineResolver = new DefaultLineResolver();
    this._serverCharacteristicsProvider =
      new DefaultServerCharacteristicsProvider();
  }
}

// Global singleton instance
export const container = new DependencyContainer();

/**
 * Configure the global container
 */
export function configureLSPClient(
  config: Partial<IDependencyContainer>,
): void {
  container.configure(config);
}

/**
 * Reset the global container to defaults
 */
export function resetLSPClientConfiguration(): void {
  container.reset();
}
