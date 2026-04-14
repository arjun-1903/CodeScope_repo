import * as vscode from 'vscode';
import { QueryParser } from '../core/queryParser';
import { SearchEngine } from '../core/searchEngine';
import { CodeIndexer } from '../utils/indexer';
import { SearchResult, IndexerConfig } from '../types';

export class SearchCommand {
  private queryParser: QueryParser;
  private searchEngine: SearchEngine;
  private indexer: CodeIndexer;
  private isIndexing: boolean = false;

  constructor() {
    this.queryParser = new QueryParser();
    this.searchEngine = new SearchEngine();
    
    const config: IndexerConfig = {
      maxFileSize: 1024 * 1024,
      excludePatterns: ['node_modules', '.git', 'dist', 'build'],
      includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      watchFiles: true,
      cacheSize: 10000
    };
    
    this.indexer = new CodeIndexer(config);
  }

  public getIndexer(): CodeIndexer {
    return this.indexer;
  }

  public async execute(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder found. Please open a folder or workspace.');
      return;
    }

    await this.ensureIndexed(workspaceFolders);

    const query = await this.getSearchQuery();
    if (!query) {
      return;
    }

    const parsedQuery = this.queryParser.parse(query);
    const elements = this.indexer.getAllElements();
    
    this.searchEngine.updateElements(elements);
    
    const results = this.searchEngine.search(parsedQuery, {
      maxResults: 50,
      threshold: 0.1,
      includeSnippets: true
    });

    if (results.length === 0) {
      vscode.window.showInformationMessage('No results found for your query.');
      return;
    }

    await this.displayResults(results, query);
  }

  public async ensureIndexed(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<void> {
    if (this.isIndexing) {
      vscode.window.showInformationMessage('Indexing in progress...');
      return;
    }

    const stats = this.indexer.getStatistics();
    if (stats.totalFiles === 0) {
      this.isIndexing = true;
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'CodeScope: Indexing workspace...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Scanning files...' });
        for (const folder of workspaceFolders) {
          await this.indexer.indexWorkspace(folder);
        }
        progress.report({ message: 'Indexing complete!' });
      });
      
      this.isIndexing = false;
      
      const newStats = this.indexer.getStatistics();
      vscode.window.showInformationMessage(
        `Indexed ${newStats.totalFiles} files with ${newStats.totalElements} code elements.`
      );
    }
  }

  private async getSearchQuery(): Promise<string | undefined> {
    const query = await vscode.window.showInputBox({
      prompt: 'Enter your search query (e.g., "functions that handle authentication")',
      placeHolder: 'functions that send email',
      ignoreFocusOut: true
    });

    return query?.trim();
  }

  private async displayResults(results: SearchResult[], originalQuery: string): Promise<void> {
    const quickPickItems = results.map(result => ({
      label: `$(symbol-${this.getSymbolIcon(result.element.type)}) ${result.element.name}`,
      description: `${result.element.type} in ${this.getRelativePath(result.element.filePath)}`,
      detail: result.relevanceReason,
      result: result
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: `Found ${results.length} results for "${originalQuery}"`
    });

    if (selected) {
      await this.navigateToResult(selected.result);
    }
  }

  private getSymbolIcon(elementType: string): string {
    const iconMap: Record<string, string> = {
      'function': 'method',
      'class': 'class',
      'method': 'method',
      'property': 'property',
      'variable': 'variable',
      'interface': 'interface',
      'type': 'type-hierarchy',
      'enum': 'enum'
    };
    return iconMap[elementType] || 'symbol-misc';
  }

  private getRelativePath(filePath: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return vscode.workspace.asRelativePath(filePath, false);
    }
    return filePath;
  }

  private async navigateToResult(result: SearchResult): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(result.element.filePath);
      const editor = await vscode.window.showTextDocument(document);
      
      const startPos = new vscode.Position(
        result.element.startLine - 1,
        result.element.startColumn - 1
      );
      const endPos = new vscode.Position(
        result.element.endLine - 1,
        result.element.endColumn - 1
      );
      
      const range = new vscode.Range(startPos, endPos);
      editor.selection = new vscode.Selection(startPos, endPos);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      
      const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        isWholeLine: false
      });
      
      editor.setDecorations(decorationType, [range]);
      
      setTimeout(() => {
        decorationType.dispose();
      }, 2000);
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  public async refreshIndex(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'CodeScope: Refreshing index...',
      cancellable: false
    }, async () => {
      for (const folder of workspaceFolders) {
        await this.indexer.indexWorkspace(folder);
      }
    });

    const stats = this.indexer.getStatistics();
    vscode.window.showInformationMessage(
      `Index refreshed: ${stats.totalFiles} files, ${stats.totalElements} elements.`
    );
  }

  public dispose(): void {
    this.indexer.dispose();
  }
}