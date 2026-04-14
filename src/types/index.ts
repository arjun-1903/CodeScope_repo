export interface CodeElement {
  name: string;
  type: ElementType;
  signature?: string;
  description?: string;
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  parameters?: Parameter[];
  returnType?: string;
  modifiers?: string[];
  context?: string;
}

export enum ElementType {
  FUNCTION = 'function',
  CLASS = 'class',
  METHOD = 'method',
  PROPERTY = 'property',
  VARIABLE = 'variable',
  INTERFACE = 'interface',
  TYPE = 'type',
  ENUM = 'enum',
  NAMESPACE = 'namespace'
}

export interface Parameter {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface SearchQuery {
  text: string;
  intent: QueryIntent;
  keywords: string[];
  actionKeywords: string[];
  elementTypes: ElementType[];
  language?: string;
}

export enum QueryIntent {
  FIND_FUNCTIONS = 'find_functions',
  FIND_CLASSES = 'find_classes',
  FIND_METHODS = 'find_methods',
  FIND_VARIABLES = 'find_variables',
  FIND_INTERFACES = 'find_interfaces',
  FIND_TYPES = 'find_types',
  FIND_ALL = 'find_all'
}

export interface SearchResult {
  element: CodeElement;
  score: number;
  snippet: string;
  matchedKeywords: string[];
  relevanceReason: string;
}

export interface WorkspaceIndex {
  files: Map<string, FileIndex>;
  elements: Map<string, CodeElement[]>;
  lastUpdated: Date;
}

export interface FileIndex {
  filePath: string;
  language: string;
  elements: CodeElement[];
  lastModified: Date;
  hash: string;
}

export interface ParsedFile {
  filePath: string;
  language: string;
  elements: CodeElement[];
  imports: string[];
  exports: string[];
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
}

export enum Language {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript'
}

export interface ParserOptions {
  includeComments?: boolean;
  includePrivate?: boolean;
  maxDepth?: number;
  excludePatterns?: string[];
}

export interface SearchOptions {
  maxResults?: number;
  threshold?: number;
  includeSnippets?: boolean;
  caseSensitive?: boolean;
  languages?: Language[];
  filePatterns?: string[];
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
}

export interface IndexerConfig {
  maxFileSize: number;
  excludePatterns: string[];
  includePatterns: string[];
  watchFiles: boolean;
  cacheSize: number;
}