/**
 * LSP feature commands aggregation
 */

import { createDefinitionCommand } from "../commands/definition.ts";
import { createReferencesCommand } from "../commands/references.ts";
import { createHoverCommand } from "../commands/hover.ts";
import {
  createCompletionCommand,
  createCompletionResolveCommand,
} from "../commands/completion.ts";
import { createDocumentSymbolsCommand } from "../commands/documentSymbols.ts";
import { createPullDiagnosticsCommand } from "../commands/diagnostics.ts";
import {
  createDocumentFormattingCommand,
  createDocumentRangeFormattingCommand,
} from "../commands/formatting.ts";
import {
  createPrepareRenameCommand,
  createRenameCommand,
} from "../commands/rename.ts";
import { createCodeActionCommand } from "../commands/codeAction.ts";
import { createSignatureHelpCommand } from "../commands/signatureHelp.ts";

export interface FeatureCommands {
  definition: ReturnType<typeof createDefinitionCommand>;
  references: ReturnType<typeof createReferencesCommand>;
  hover: ReturnType<typeof createHoverCommand>;
  completion: ReturnType<typeof createCompletionCommand>;
  completionResolve: ReturnType<typeof createCompletionResolveCommand>;
  documentSymbols: ReturnType<typeof createDocumentSymbolsCommand>;
  pullDiagnostics: ReturnType<typeof createPullDiagnosticsCommand>;
  formatting: ReturnType<typeof createDocumentFormattingCommand>;
  rangeFormatting: ReturnType<typeof createDocumentRangeFormattingCommand>;
  prepareRename: ReturnType<typeof createPrepareRenameCommand>;
  rename: ReturnType<typeof createRenameCommand>;
  codeAction: ReturnType<typeof createCodeActionCommand>;
  signatureHelp: ReturnType<typeof createSignatureHelpCommand>;
}

export function createFeatureCommands(): FeatureCommands {
  return {
    definition: createDefinitionCommand(),
    references: createReferencesCommand(),
    hover: createHoverCommand(),
    completion: createCompletionCommand(),
    completionResolve: createCompletionResolveCommand(),
    documentSymbols: createDocumentSymbolsCommand(),
    pullDiagnostics: createPullDiagnosticsCommand(),
    formatting: createDocumentFormattingCommand(),
    rangeFormatting: createDocumentRangeFormattingCommand(),
    prepareRename: createPrepareRenameCommand(),
    rename: createRenameCommand(),
    codeAction: createCodeActionCommand(),
    signatureHelp: createSignatureHelpCommand(),
  };
}
