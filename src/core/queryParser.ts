import { SearchQuery, QueryIntent, ElementType } from '../types';

export class QueryParser {
  private static readonly FUNCTION_KEYWORDS = [
    'function', 'functions', 'method', 'methods', 'procedure', 'procedures',
    'routine', 'routines', 'func', 'def', 'lambda'
  ];

  private static readonly CLASS_KEYWORDS = [
    'class', 'classes', 'object', 'objects', 'type', 'types',
    'struct', 'structs', 'interface', 'interfaces'
  ];

  private static readonly VARIABLE_KEYWORDS = [
    'variable', 'variables', 'var', 'vars', 'field', 'fields',
    'property', 'properties', 'constant', 'constants', 'const'
  ];

  private static readonly ACTION_KEYWORDS = [
    'handle', 'handles', 'handling', 'process', 'processes', 'processing',
    'manage', 'manages', 'managing', 'deal', 'deals', 'dealing',
    'send', 'sends', 'sending', 'receive', 'receives', 'receiving',
    'create', 'creates', 'creating', 'delete', 'deletes', 'deleting',
    'update', 'updates', 'updating', 'get', 'gets', 'getting',
    'set', 'sets', 'setting', 'validate', 'validates', 'validating',
    'authenticate', 'authenticates', 'authenticating', 'authorize',
    'authorizes', 'authorizing', 'connect', 'connects', 'connecting',
    'parse', 'parses', 'parsing', 'format', 'formats', 'formatting',
    'calculate', 'calculates', 'calculating', 'compute', 'computes',
    'computing', 'render', 'renders', 'rendering', 'display',
    'displays', 'displaying', 'show', 'shows', 'showing'
  ];

  private static readonly DOMAIN_KEYWORDS = [
    'database', 'db', 'sql', 'query', 'queries', 'table', 'tables',
    'authentication', 'auth', 'login', 'logout', 'password', 'token',
    'user', 'users', 'session', 'sessions', 'permission', 'permissions',
    'email', 'mail', 'message', 'messages', 'notification', 'notifications',
    'file', 'files', 'upload', 'download', 'storage', 'cache', 'caching',
    'api', 'endpoint', 'endpoints', 'request', 'requests', 'response',
    'responses', 'http', 'https', 'server', 'client', 'network',
    'validation', 'validator', 'error', 'errors', 'exception', 'exceptions',
    'config', 'configuration', 'settings', 'preferences', 'options',
    'log', 'logs', 'logging', 'debug', 'debugging', 'test', 'tests',
    'testing', 'mock', 'mocks', 'mocking', 'util', 'utils', 'utility',
    'helper', 'helpers', 'service', 'services', 'controller', 'controllers',
    'model', 'models', 'view', 'views', 'component', 'components'
  ];

  public parse(queryText: string): SearchQuery {
    const normalizedQuery = this.normalizeQuery(queryText);
    const words = this.tokenize(normalizedQuery);
    
    const intent = this.determineIntent(words);
    const elementTypes = this.extractElementTypes(words, intent);
    const keywords = this.extractKeywords(words);
    const actionKeywords = this.extractActionKeywords(words);

    return {
      text: queryText,
      intent,
      keywords,
      actionKeywords,
      elementTypes
    };
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase().replace(/[.,!?]/g, "").trim();
  }

  private tokenize(query: string): string[] {
    return query.split(/\s+/).filter(word => word.length > 0);
  }

  private determineIntent(words: string[]): QueryIntent {
    const hasFunction = words.some(word => 
      QueryParser.FUNCTION_KEYWORDS.includes(word)
    );
    const hasClass = words.some(word => 
      QueryParser.CLASS_KEYWORDS.includes(word)
    );
    const hasVariable = words.some(word => 
      QueryParser.VARIABLE_KEYWORDS.includes(word)
    );

    if (hasFunction && !hasClass && !hasVariable) {
      return QueryIntent.FIND_FUNCTIONS;
    }
    if (hasClass && !hasFunction && !hasVariable) {
      return QueryIntent.FIND_CLASSES;
    }
    if (hasVariable && !hasFunction && !hasClass) {
      return QueryIntent.FIND_VARIABLES;
    }

    if (words.some(word => word === 'interface' || word === 'interfaces')) {
      return QueryIntent.FIND_INTERFACES;
    }
    if (words.some(word => word === 'type' || word === 'types')) {
      return QueryIntent.FIND_TYPES;
    }

    return QueryIntent.FIND_ALL;
  }

  private extractElementTypes(words: string[], intent: QueryIntent): ElementType[] {
    const types: ElementType[] = [];

    switch (intent) {
      case QueryIntent.FIND_FUNCTIONS:
        types.push(ElementType.FUNCTION, ElementType.METHOD);
        break;
      case QueryIntent.FIND_CLASSES:
        types.push(ElementType.CLASS);
        break;
      case QueryIntent.FIND_VARIABLES:
        types.push(ElementType.VARIABLE, ElementType.PROPERTY);
        break;
      case QueryIntent.FIND_INTERFACES:
        types.push(ElementType.INTERFACE);
        break;
      case QueryIntent.FIND_TYPES:
        types.push(ElementType.TYPE, ElementType.INTERFACE);
        break;
      case QueryIntent.FIND_ALL:
      default:
        types.push(
          ElementType.FUNCTION,
          ElementType.CLASS,
          ElementType.METHOD,
          ElementType.VARIABLE,
          ElementType.PROPERTY,
          ElementType.INTERFACE,
          ElementType.TYPE,
          ElementType.ENUM
        );
        break;
    }

    return types;
  }

  private stemWord(word: string): string {
    let stem = word;
    if (stem.endsWith('ies')) return stem.slice(0, -3) + 'y';
    if (stem.endsWith('es') && !stem.endsWith('ses')) return stem.slice(0, -2);
    if (stem.endsWith('s') && !stem.endsWith('ss')) stem = stem.slice(0, -1);
    if (stem.endsWith('ing')) return stem.slice(0, -3);
    if (stem.endsWith('ed')) return stem.slice(0, -2);
    return stem;
  }

  private extractKeywords(words: string[]): string[] {
    const keywords: string[] = [];

    words.forEach(word => {
      if (this.isStopWord(word)) {
        return;
      }
      
      if (QueryParser.DOMAIN_KEYWORDS.includes(word)) {
        keywords.push(this.stemWord(word));
      } else if (!QueryParser.FUNCTION_KEYWORDS.includes(word) &&
                 !QueryParser.CLASS_KEYWORDS.includes(word) &&
                 !QueryParser.VARIABLE_KEYWORDS.includes(word) &&
                 !QueryParser.ACTION_KEYWORDS.includes(word)) {
        keywords.push(this.stemWord(word));
      }
    });

    return [...new Set(keywords)];
  }

  private extractActionKeywords(words: string[]): string[] {
    const actions: string[] = [];
    words.forEach(word => {
      if (QueryParser.ACTION_KEYWORDS.includes(word)) {
        actions.push(this.stemWord(word));
      }
    });
    return [...new Set(actions)];
  }

  private isStopWord(word: string): boolean {
    const stopWords = [
      'that', 'with', 'for', 'and', 'or', 'in', 'on', 'at', 'to', 'from',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'all', 'any', 'some', 'this',
      'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'how', 'what', 'where', 'why', 'when', 'who'
    ];
    return stopWords.includes(word);
  }

  public getSuggestions(partialQuery: string): string[] {
    const suggestions: string[] = [];
    const words = this.tokenize(partialQuery.toLowerCase());
    const lastWord = words[words.length - 1] || '';

    const allKeywords = [
      ...QueryParser.FUNCTION_KEYWORDS,
      ...QueryParser.CLASS_KEYWORDS,
      ...QueryParser.VARIABLE_KEYWORDS,
      ...QueryParser.ACTION_KEYWORDS,
      ...QueryParser.DOMAIN_KEYWORDS
    ];

    allKeywords.forEach(keyword => {
      if (keyword.startsWith(lastWord) && keyword !== lastWord) {
        suggestions.push(keyword);
      }
    });

    return suggestions.slice(0, 10);
  }
}