import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TypeScriptParser } from '../parsers/typescriptParser';
import { WorkspaceIndex, FileIndex, CodeElement, IndexerConfig, Language } from '../types';
import { VectorIndex } from '../ai/vectorIndex';

export class CodeIndexer {
  private index: WorkspaceIndex;
  private parser: TypeScriptParser;
  private config: IndexerConfig;
  private fileWatcher?: vscode.FileSystemWatcher;
  public vectorIndex: VectorIndex;

  constructor(config: IndexerConfig) {
    this.config = config;
    this.parser = new TypeScriptParser();
    this.index = {
      files: new Map(),
      elements: new Map(),
      lastUpdated: new Date()
    };
    this.vectorIndex = new VectorIndex();
  }

  public async indexWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const files = await this.findCodeFiles(workspaceFolder.uri.fsPath);
    
    for (const filePath of files) {
      await this.indexFile(filePath);
    }

    if (this.config.watchFiles) {
      this.setupFileWatcher(workspaceFolder);
    }

    this.index.lastUpdated = new Date();
    
    // Background execution to vectorize all elements
    setTimeout(() => {
      this.vectorIndex.rebuildIndex(this.getAllElements());
    }, 100);
  }

  public async indexFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      
      if (stats.size > this.config.maxFileSize) {
        console.warn(`Skipping large file: ${filePath}`);
        return;
      }

      const existingIndex = this.index.files.get(filePath);
      const fileHash = this.calculateFileHash(stats.mtime);
      
      if (existingIndex && existingIndex.hash === fileHash) {
        return;
      }

      const parsedFile = await this.parser.parseFile(filePath);
      
      const fileIndex: FileIndex = {
        filePath,
        language: parsedFile.language,
        elements: parsedFile.elements,
        lastModified: stats.mtime,
        hash: fileHash
      };

      this.index.files.set(filePath, fileIndex);
      this.index.elements.set(filePath, parsedFile.elements);

    } catch (error) {
      console.error(`Error indexing file ${filePath}:`, error);
    }
  }

  public removeFile(filePath: string): void {
    this.index.files.delete(filePath);
    this.index.elements.delete(filePath);
  }

  public getAllElements(): CodeElement[] {
    const allElements: CodeElement[] = [];
    for (const elements of this.index.elements.values()) {
      allElements.push(...elements);
    }
    return allElements;
  }

  public getElementsForFile(filePath: string): CodeElement[] {
    return this.index.elements.get(filePath) || [];
  }

  public getFileIndex(filePath: string): FileIndex | undefined {
    return this.index.files.get(filePath);
  }

  public getWorkspaceIndex(): WorkspaceIndex {
    return this.index;
  }

  public getStatistics(): {
    totalFiles: number;
    totalElements: number;
    elementsByLanguage: Record<string, number>;
    lastUpdated: Date;
  } {
    const elementsByLanguage: Record<string, number> = {};
    let totalElements = 0;

    for (const fileIndex of this.index.files.values()) {
      const count = fileIndex.elements.length;
      totalElements += count;
      elementsByLanguage[fileIndex.language] = (elementsByLanguage[fileIndex.language] || 0) + count;
    }

    return {
      totalFiles: this.index.files.size,
      totalElements,
      elementsByLanguage,
      lastUpdated: this.index.lastUpdated
    };
  }

  private async findCodeFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

    const traverse = async (dir: string): Promise<void> => {
      try {
        const items = await fs.promises.readdir(dir);
        
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stats = await fs.promises.stat(itemPath);
          
          if (stats.isDirectory()) {
            if (!this.shouldExcludeDirectory(itemPath)) {
              await traverse(itemPath);
            }
          } else if (stats.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (supportedExtensions.includes(ext) && !this.shouldExcludeFile(itemPath)) {
              files.push(itemPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error traversing directory ${dir}:`, error);
      }
    };

    await traverse(rootPath);
    return files;
  }

  private shouldExcludeDirectory(dirPath: string): boolean {
    const dirName = path.basename(dirPath);
    const excludePatterns = [
      'node_modules',
      '.git',
      '.vscode',
      'dist',
      'build',
      'out',
      'coverage',
      '.nyc_output',
      ...this.config.excludePatterns
    ];

    return excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'));
        return regex.test(dirPath);
      }
      return dirName === pattern || dirPath.split(path.sep).includes(pattern);
    });
  }

  private shouldExcludeFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const excludePatterns = [
      '*.min.js',
      '*.d.ts',
      '*.test.ts',
      '*.spec.ts',
      '*.test.js',
      '*.spec.js',
      ...this.config.excludePatterns
    ];

    return excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'));
        return regex.test(fileName);
      }
      return fileName === pattern;
    });
  }

  private calculateFileHash(mtime: Date): string {
    return `${mtime.getTime()}`;
  }

  private setupFileWatcher(workspaceFolder: vscode.WorkspaceFolder): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }

    const pattern = new vscode.RelativePattern(
      workspaceFolder,
      '**/*.{ts,tsx,js,jsx}'
    );

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.fileWatcher.onDidCreate(async (uri) => {
      await this.indexFile(uri.fsPath);
    });

    this.fileWatcher.onDidChange(async (uri) => {
      await this.indexFile(uri.fsPath);
    });

    this.fileWatcher.onDidDelete((uri) => {
      this.removeFile(uri.fsPath);
    });
  }

  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
  }
}