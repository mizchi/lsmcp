import {
  getCompilerOptionsFromTsConfig,
  Node,
  Project,
  type SourceFile,
} from "ts-morph";
import { err, ok, type Result } from "neverthrow";

export interface RenameRequest {
  filePath: string;
  line: number;
  symbolName: string;
  newName: string;
  renameInComments?: boolean;
  renameInStrings?: boolean;
}

export interface RenameSuccess {
  message: string;
  changedFiles: {
    filePath: string;
    changes: {
      line: number;
      column: number;
      oldText: string;
      newText: string;
    }[];
  }[];
}

/**
 * Create or get a project
 */
export function createProject(tsConfigPath?: string): Project {
  if (tsConfigPath) {
    const { errors } = getCompilerOptionsFromTsConfig(tsConfigPath);
    if (errors.length > 0) {
      throw new Error(
        `Failed to read tsconfig: ${
          errors
            .map((e) => {
              const messageText = e.getMessageText();
              return typeof messageText === "string"
                ? messageText
                : messageText.getMessageText();
            })
            .join(", ")
        }`,
      );
    }
    return new Project({
      tsConfigFilePath: tsConfigPath, // Specify `tsConfigFilePath` instead of `compilerOptions` to load files
      skipAddingFilesFromTsConfig: false,
    });
  }

  return new Project({
    skipAddingFilesFromTsConfig: false,
  });
}

/**
 * Execute symbol rename by specifying file path, line number, and symbol name
 */
export async function renameSymbol(
  project: Project,
  request: RenameRequest,
): Promise<Result<RenameSuccess, string>> {
  try {
    // Get source file
    const sourceFile = project.getSourceFile(request.filePath);
    if (!sourceFile) {
      return err(`File not found: ${request.filePath}`);
    }

    // Find symbol at specified line
    let node: Node | undefined;
    try {
      node = findSymbolAtLine(sourceFile, request.line, request.symbolName);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }

    if (!node) {
      return err(
        `Symbol "${request.symbolName}" not found at line ${
          String(
            request.line,
          )
        }`,
      );
    }

    // Record state before rename
    const beforeStates = captureFileStates(project);

    // Execute rename
    if (Node.isIdentifier(node)) {
      node.rename(request.newName, {
        renameInComments: request.renameInComments || false,
        renameInStrings: request.renameInStrings || false,
      });
    } else if (hasRenameMethod(node)) {
      const renameableNode = node as Node & {
        rename: (
          newName: string,
          options?: { renameInComments?: boolean; renameInStrings?: boolean },
        ) => void;
      };
      renameableNode.rename(request.newName, {
        renameInComments: request.renameInComments || false,
        renameInStrings: request.renameInStrings || false,
      });
    } else {
      return err(`Cannot rename node of type ${node.getKindName()}`);
    }

    // Detect changes
    const changedFiles = detectChanges(project, beforeStates);

    // Save project
    await project.save();

    return ok({
      message:
        `Successfully renamed symbol "${request.symbolName}" to "${request.newName}"`,
      changedFiles,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Find a node that matches the specified line and symbol name
 */
function findSymbolAtLine(
  sourceFile: SourceFile,
  line: number,
  symbolName: string,
): Node | undefined {
  const candidateNodes: Node[] = [];

  sourceFile.forEachDescendant((node) => {
    const startLine = sourceFile.getLineAndColumnAtPos(node.getStart()).line;

    // Check only nodes starting from the specified line
    if (line === startLine) {
      // For identifiers
      if (Node.isIdentifier(node) && node.getText() === symbolName) {
        // Prioritize parent node if it's a named node
        const parent = node.getParent();
        if (hasGetNameMethod(parent)) {
          try {
            const namedParent = parent as Node & { getName: () => string };
            if (namedParent.getName() === symbolName) {
              // Use parent node (to avoid duplicates)
              if (!candidateNodes.some((n) => n === parent)) {
                candidateNodes.push(parent);
              }
              return; // Don't add the identifier itself
            }
          } catch {
            // Use identifier if getName() is not available
          }
        }
        candidateNodes.push(node);
      }

      // For named nodes (classes, functions, variables, etc.)
      if (hasGetNameMethod(node)) {
        try {
          const namedNode = node as Node & { getName: () => string };
          if (namedNode.getName() === symbolName) {
            candidateNodes.push(node);
          }
        } catch {
          // Ignore nodes where getName() is not available
        }
      }

      // For variable declarations
      if (Node.isVariableDeclaration(node)) {
        const nameNode = node.getNameNode();
        if (Node.isIdentifier(nameNode) && nameNode.getText() === symbolName) {
          candidateNodes.push(node); // Use variable declaration node
        }
      }
    }
  });

  // Remove duplicates (merge different node types representing the same symbol)
  const uniqueNodes = candidateNodes.filter((node) => {
    // If there are other nodes starting from the same position, prioritize more specific nodes
    const nodeStart = node.getStart();
    const duplicates = candidateNodes.filter((n) => n.getStart() === nodeStart);

    if (duplicates.length > 1) {
      // Prioritize named nodes (classes, functions, etc.)
      const namedNodes = duplicates.filter(
        (n) => hasGetNameMethod(n) || Node.isVariableDeclaration(n),
      );
      if (namedNodes.length > 0) {
        return namedNodes[0] === node;
      }
    }

    return true;
  });

  // If there are still multiple candidates, they might be at different positions on the same line
  if (uniqueNodes.length > 1) {
    // Sort by column position and check only those at the same column
    const firstNodeCol = sourceFile.getLineAndColumnAtPos(
      uniqueNodes[0].getStart(),
    ).column;
    const sameColumnNodes = uniqueNodes.filter(
      (n) =>
        sourceFile.getLineAndColumnAtPos(n.getStart()).column === firstNodeCol,
    );

    if (sameColumnNodes.length > 1) {
      throw new Error(
        `Multiple occurrences of symbol "${symbolName}" found on line ${
          String(
            line,
          )
        }. Please be more specific.`,
      );
    }

    // Use the first occurrence if at different column positions
    return uniqueNodes[0];
  }

  return uniqueNodes[0];
}

/**
 * Capture current state of all source files
 */
function captureFileStates(project: Project): Map<string, string> {
  const states = new Map<string, string>();
  for (const sourceFile of project.getSourceFiles()) {
    states.set(sourceFile.getFilePath(), sourceFile.getFullText());
  }
  return states;
}

/**
 * Detect file changes and return details
 */
function detectChanges(
  project: Project,
  beforeStates: Map<string, string>,
): RenameSuccess["changedFiles"] {
  const changedFiles: RenameSuccess["changedFiles"] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const beforeText = beforeStates.get(filePath);
    const afterText = sourceFile.getFullText();

    if (beforeText && beforeText !== afterText) {
      const changes = diffTexts(sourceFile, beforeText, afterText);
      if (changes.length > 0) {
        changedFiles.push({
          filePath,
          changes,
        });
      }
    }
  }

  return changedFiles;
}

/**
 * Detect text differences (simplified version)
 */
function diffTexts(
  _sourceFile: SourceFile,
  beforeText: string,
  afterText: string,
): { line: number; column: number; oldText: string; newText: string }[] {
  const changes: {
    line: number;
    column: number;
    oldText: string;
    newText: string;
  }[] = [];

  const beforeLines = beforeText.split("\n");
  const afterLines = afterText.split("\n");

  for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i++) {
    const beforeLine = beforeLines[i] || "";
    const afterLine = afterLines[i] || "";

    if (beforeLine !== afterLine) {
      // Simply record the entire line as a change
      changes.push({
        line: i + 1,
        column: 1,
        oldText: beforeLine,
        newText: afterLine,
      });
    }
  }

  return changes;
}

/**
 * Check if a node has the rename() method
 */
function hasRenameMethod(node: Node): boolean {
  return (
    Node.isClassDeclaration(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeAliasDeclaration(node) ||
    Node.isEnumDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isPropertyDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node) ||
    Node.isParameterDeclaration(node) ||
    Node.isVariableDeclaration(node)
  );
}

/**
 * Check if a node has the getName() method
 */
function hasGetNameMethod(node: Node): boolean {
  return (
    Node.isClassDeclaration(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeAliasDeclaration(node) ||
    Node.isEnumDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isPropertyDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node)
  );
}

/**
 * Add a source file to the project
 */
export function addSourceFile(project: Project, filePath: string): SourceFile {
  return project.addSourceFileAtPath(filePath);
}

/**
 * Add multiple source files to the project
 */
export function addSourceFiles(project: Project, glob: string): SourceFile[] {
  return project.addSourceFilesAtPaths(glob);
}
