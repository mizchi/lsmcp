import type { SymbolKind, Location } from "vscode-languageserver-protocol";

export interface SerenitySymbol {
  namePath: string;
  kind: SymbolKind;
  location: Location;
  containerName?: string;
  children?: SerenitySymbol[];
}

export interface SerenityEditResult {
  success: boolean;
  error?: string;
  filesChanged?: string[];
}

export interface SerenityMemory {
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerenityContext {
  rootPath: string;
  projectName?: string;
}

export interface CachedSymbol {
  id?: number;
  filePath: string;
  namePath: string;
  kind: number;
  containerName?: string;
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  lastModified: number;
  projectRoot: string;
}
