import { bench, describe } from "vitest";
import {
  ContentHashDiffChecker,
  OptimizedDiffChecker,
} from "./fileDiffDetector.ts";
import { createTestFileSymbols } from "./testHelpers.ts";

describe("FileDiffDetector Benchmarks", () => {
  const smallContent = "const x = 1;";
  const mediumContent = `
    export class TestClass {
      constructor(private value: string) {}
      
      getValue(): string {
        return this.value;
      }
      
      setValue(val: string): void {
        this.value = val;
      }
    }
  `.repeat(10);
  
  const largeContent = "x".repeat(100000); // 100KB
  const veryLargeContent = "x".repeat(1000000); // 1MB
  
  // Test data with different scenarios
  const existingFileUnchanged = createTestFileSymbols({
    contentHash: "749b17640bf18d96c509f518d6f1a4b41d8cdc60", // SHA1 hash of "const x = 1;"
  });
  
  const existingFileChanged = createTestFileSymbols({
    contentHash: "different_hash_value",
  });

  describe("ContentHashDiffChecker", () => {
    const checker = new ContentHashDiffChecker();
    
    bench("new file - small content", () => {
      checker.checkFile(smallContent, undefined);
    });
    
    bench("new file - medium content", () => {
      checker.checkFile(mediumContent, undefined);
    });
    
    bench("new file - large content (100KB)", () => {
      checker.checkFile(largeContent, undefined);
    });
    
    bench("new file - very large content (1MB)", () => {
      checker.checkFile(veryLargeContent, undefined);
    });
    
    bench("unchanged file - small content", () => {
      checker.checkFile(smallContent, existingFileUnchanged);
    });
    
    bench("changed file - small content", () => {
      checker.checkFile(smallContent, existingFileChanged);
    });
    
    bench("unchanged file - medium content", () => {
      checker.checkFile(mediumContent, {
        ...existingFileUnchanged,
        contentHash: "8a7f3d2b1e4c5a6b9d8e7f2c3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3",
      });
    });
    
    bench("changed file - large content", () => {
      checker.checkFile(largeContent, existingFileChanged);
    });
  });

  describe("OptimizedDiffChecker", () => {
    const checker = new OptimizedDiffChecker();
    
    bench("new file - small content", () => {
      checker.checkFile(smallContent, undefined);
    });
    
    bench("new file - medium content", () => {
      checker.checkFile(mediumContent, undefined);
    });
    
    bench("new file - large content (100KB)", () => {
      checker.checkFile(largeContent, undefined);
    });
    
    bench("unchanged file - small content", () => {
      checker.checkFile(smallContent, existingFileUnchanged);
    });
    
    bench("changed file - small content", () => {
      checker.checkFile(smallContent, existingFileChanged);
    });
  });

  describe("Batch Processing", () => {
    const checker = new ContentHashDiffChecker();
    const files = Array.from({ length: 100 }, (_, i) => `const x = ${i};`);
    
    bench("process 100 small files", () => {
      for (const content of files) {
        checker.checkFile(content, undefined);
      }
    });
    
    bench("process 100 small files with cache check", () => {
      for (const content of files) {
        checker.checkFile(content, existingFileChanged);
      }
    });
  });

  describe("Unicode and Special Characters", () => {
    const checker = new ContentHashDiffChecker();
    const unicodeContent = "const 変数 = '🎉 Unicode テスト';\n".repeat(100);
    const specialCharsContent = "const str = `\n\t\r\\n${variable}`;\n".repeat(100);
    
    bench("unicode content hashing", () => {
      checker.checkFile(unicodeContent, undefined);
    });
    
    bench("special characters content hashing", () => {
      checker.checkFile(specialCharsContent, undefined);
    });
  });

  describe("Comparison: ContentHashDiffChecker vs OptimizedDiffChecker", () => {
    const contentChecker = new ContentHashDiffChecker();
    const optimizedChecker = new OptimizedDiffChecker();
    const testContent = mediumContent;
    
    bench("ContentHashDiffChecker - mixed operations", () => {
      // New file
      contentChecker.checkFile(testContent, undefined);
      // Unchanged file
      contentChecker.checkFile(smallContent, existingFileUnchanged);
      // Changed file
      contentChecker.checkFile(testContent, existingFileChanged);
    });
    
    bench("OptimizedDiffChecker - mixed operations", () => {
      // New file
      optimizedChecker.checkFile(testContent, undefined);
      // Unchanged file
      optimizedChecker.checkFile(smallContent, existingFileUnchanged);
      // Changed file
      optimizedChecker.checkFile(testContent, existingFileChanged);
    });
  });

  describe("Memory Efficiency", () => {
    const checker = new ContentHashDiffChecker();
    
    bench("repeated hashing of same content", () => {
      const content = "const x = 1;";
      for (let i = 0; i < 100; i++) {
        checker.checkFile(content, undefined);
      }
    });
    
    bench("hashing of incrementally changing content", () => {
      for (let i = 0; i < 100; i++) {
        const content = `const x = ${i};`;
        checker.checkFile(content, undefined);
      }
    });
  });

  describe("Real-world Scenarios", () => {
    const checker = new ContentHashDiffChecker();
    
    // Simulate a TypeScript file with imports, classes, and functions
    const realWorldFile = `
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private apiUrl = 'https://api.example.com';
  
  constructor(private http: HttpClient) {}
  
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(\`\${this.apiUrl}/users\`).pipe(
      map(users => users.map(user => ({
        ...user,
        fullName: \`\${user.firstName} \${user.lastName}\`
      }))),
      catchError(this.handleError)
    );
  }
  
  private handleError(error: any): Observable<never> {
    console.error('An error occurred:', error);
    throw error;
  }
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}
`.repeat(5);
    
    bench("real-world TypeScript file - new", () => {
      checker.checkFile(realWorldFile, undefined);
    });
    
    bench("real-world TypeScript file - unchanged", () => {
      const existingFile = createTestFileSymbols({
        uri: "file:///service.ts",
        contentHash: checker.checkFile(realWorldFile, undefined).contentHash,
      });
      checker.checkFile(realWorldFile, existingFile);
    });
    
    bench("real-world TypeScript file - changed", () => {
      const existingFile = createTestFileSymbols({
        uri: "file:///service.ts",
        contentHash: "outdated_hash",
      });
      checker.checkFile(realWorldFile, existingFile);
    });
  });
});

// Helper benchmark to establish baseline
describe("Baseline Operations", () => {
  bench("SHA1 hashing only - small", () => {
    const crypto = require("crypto");
    crypto.createHash("sha1").update("const x = 1;").digest("hex");
  });
  
  bench("SHA1 hashing only - 100KB", () => {
    const crypto = require("crypto");
    crypto.createHash("sha1").update("x".repeat(100000)).digest("hex");
  });
  
  bench("SHA1 hashing only - 1MB", () => {
    const crypto = require("crypto");
    crypto.createHash("sha1").update("x".repeat(1000000)).digest("hex");
  });
  
  bench("SHA256 hashing only - small (comparison)", () => {
    const crypto = require("crypto");
    crypto.createHash("sha256").update("const x = 1;").digest("hex");
  });
  
  bench("SHA256 hashing only - 100KB (comparison)", () => {
    const crypto = require("crypto");
    crypto.createHash("sha256").update("x".repeat(100000)).digest("hex");
  });
  
  bench("string comparison - small", () => {
    const a = "3f41cbb303012f33212c92326b27f6cc604fd414e20315cb10f2be7f1f6bb83c";
    const b = "3f41cbb303012f33212c92326b27f6cc604fd414e20315cb10f2be7f1f6bb83c";
    a === b;
  });
  
  bench("object property access", () => {
    const obj = {
      uri: "file:///test.ts",
      symbols: [],
      contentHash: "hash",
      gitHash: undefined,
    };
    obj.contentHash;
  });
});