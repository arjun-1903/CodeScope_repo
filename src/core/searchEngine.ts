import { CodeElement, SearchQuery, SearchResult, SearchOptions, ElementType, QueryIntent } from '../types';

export class SearchEngine {
  private elements: CodeElement[] = [];

  constructor(elements: CodeElement[] = []) {
    this.elements = elements;
  }

  public updateElements(elements: CodeElement[]): void {
    this.elements = elements;
  }

  public search(query: SearchQuery, options: SearchOptions = {}): SearchResult[] {
    const {
      maxResults = 50,
      threshold = 0.2, // Increased threshold to filter out low-quality results
      includeSnippets = true,
      caseSensitive = false,
      languages = [],
      filePatterns = []
    } = options;

    let filteredElements = this.elements;

    if (query.elementTypes.length > 0) {
      filteredElements = filteredElements.filter(element =>
        query.elementTypes.includes(element.type)
      );
    }

    if (languages.length > 0) {
      filteredElements = filteredElements.filter(element => {
        const extMap: Record<string, string[]> = {
          'typescript': ['.ts', '.tsx'],
          'javascript': ['.js', '.jsx']
        };
        const validExts = languages.flatMap(lang => extMap[lang as string] || [`.${lang}`]);
        return validExts.some(ext => element.filePath.endsWith(ext));
      });
    }

    if (filePatterns.length > 0) {
      filteredElements = filteredElements.filter(element =>
        filePatterns.some(pattern => this.matchesPattern(element.filePath, pattern))
      );
    }

    const results: SearchResult[] = [];

    for (const element of filteredElements) {
      const score = this.calculateScore(element, query, caseSensitive);
      
      if (score >= threshold) {
        const snippet = includeSnippets ? this.generateSnippet(element) : '';
        const matchedKeywords = this.getMatchedKeywords(element, query.keywords, caseSensitive);
        const relevanceReason = this.getRelevanceReason(element, query, matchedKeywords);

        results.push({
          element,
          score,
          snippet,
          matchedKeywords,
          relevanceReason
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Calculates the relevance score for a code element against a search query.
   * This new algorithm prioritizes completeness (matching all keywords) and the location of matches.
   */
  private calculateScore(element: CodeElement, query: SearchQuery, caseSensitive: boolean): number {
    const normalize = (text: string) => caseSensitive ? text : text.toLowerCase();
    const keywords = [...new Set(query.keywords)]; // Use unique keywords from the query

    if (keywords.length === 0) return 0;

    let baseScore = 0;
    let matchedKeywordsCount = 0;

    const elementName = normalize(element.name);
    const elementSignature = normalize(element.signature || '');
    const elementDescription = normalize(element.description || '');

    // For each keyword, find the best possible match location and score it.
    for (const keyword of keywords) {
        const normalizedKeyword = normalize(keyword);
        let keywordFound = false;
        
        // Check in order of importance: Name > Signature > Description > Parameters
        if (elementName.includes(normalizedKeyword)) {
            baseScore += 1.5 * this.getNameMatchScore(elementName, normalizedKeyword);
            keywordFound = true;
        } else if (elementSignature.includes(normalizedKeyword)) {
            baseScore += 0.6;
            keywordFound = true;
        } else if (elementDescription.includes(normalizedKeyword)) {
            baseScore += 0.3;
            keywordFound = true;
        } else if (element.parameters?.some(p => normalize(p.name).includes(normalizedKeyword))) {
            baseScore += 0.4;
            keywordFound = true;
        }
        
        if (keywordFound) {
            matchedKeywordsCount++;
        }
    }

    // Evaluate optional action words for bonus points, but don't fail completeness metrics
    for (const action of query.actionKeywords) {
        const normalizedAction = normalize(action);
        if (elementName.includes(normalizedAction)) {
            baseScore += 0.4;
        } else if (elementDescription.includes(normalizedAction)) {
            baseScore += 0.2;
        }
    }

    if (keywords.length === 0 && query.actionKeywords.length === 0) return 0;
    
    // --- The Core Improvement ---
    // Calculate a "completeness factor". This heavily penalizes partial matches.
    const completenessFactor = keywords.length === 0 ? 1.0 : matchedKeywordsCount / keywords.length;

    // If a result matches less than half the keywords, it's probably not relevant.
    // This is a powerful filter for multi-word queries.
    if (keywords.length > 1 && completenessFactor < 0.5) {
        return 0;
    }

    // Use the completeness factor as a multiplier. Squaring it gives exponentially
    // more weight to results that are more complete.
    // e.g., 100% complete = 1.0 multiplier, 50% complete = 0.25 multiplier.
    let finalScore = baseScore * (completenessFactor * completenessFactor);

    if (matchedKeywordsCount > 0 || keywords.length === 0) {
        // Add a small bonus for matching the precise element type the user asked for.
        if (query.intent === QueryIntent.FIND_FUNCTIONS && element.type === ElementType.FUNCTION) {
            finalScore += 0.2; // Bonus for a pure function when "function" was specified
        } else if (query.elementTypes.includes(element.type)) {
            finalScore += 0.1; // Smaller bonus for a related type (e.g., a method)
        }
    }
    
    // Normalize the score to be roughly between 0 and 1
    const maxPossibleScore = (keywords.length * 1.5 * 1.5) + 0.2; // A rough upper bound
    return Math.min(finalScore / maxPossibleScore, 1.0);
  }

  /**
   * Provides a score based on how well the keyword matches the element's name.
   * Exact and prefix matches are scored higher.
   */
  private getNameMatchScore(elementName: string, keyword: string): number {
    if (elementName === keyword) return 1.5;      // Boost for exact match
    if (elementName.startsWith(keyword)) return 1.2; // Boost for prefix match
    if (elementName.endsWith(keyword)) return 0.8;
    if (elementName.includes(keyword)) return 0.6; // A simple containment is worth less
    return 0;
  }


  private getMatchedKeywords(element: CodeElement, keywords: string[], caseSensitive: boolean): string[] {
    const normalize = (text: string) => caseSensitive ? text : text.toLowerCase();
    const matchedKeywords: string[] = [];

    const searchableText = [
      element.name,
      element.description || '',
      element.signature || '',
      ...(element.parameters?.map(p => p.name) || [])
    ].join(' ');

    const normalizedSearchable = normalize(searchableText);

    for (const keyword of keywords) {
      if (normalizedSearchable.includes(normalize(keyword))) {
        matchedKeywords.push(keyword);
      }
    }

    return matchedKeywords;
  }

  private getRelevanceReason(element: CodeElement, query: SearchQuery, matchedKeywords: string[]): string {
    if (matchedKeywords.length === 0) {
      return 'General relevance match';
    }
    const totalKeywords = new Set(query.keywords).size;
    const reason = `Matches ${matchedKeywords.length} of ${totalKeywords} keywords: ${matchedKeywords.join(', ')}`;
    return reason;
  }

  private generateSnippet(element: CodeElement): string {
    const lines: string[] = [];
    
    if (element.description) {
      const summary = element.description.split('\n')[0];
      lines.push(`// ${summary}`);
    }
    lines.push(element.signature || `${element.name}`);

    return lines.join('\n');
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  public getStatistics(): {
    totalElements: number;
    elementsByType: Record<ElementType, number>;
    fileCount: number;
  } {
    const elementsByType = {} as Record<ElementType, number>;
    const files = new Set<string>();

    for (const element of this.elements) {
      elementsByType[element.type] = (elementsByType[element.type] || 0) + 1;
      files.add(element.filePath);
    }

    return {
      totalElements: this.elements.length,
      elementsByType,
      fileCount: files.size
    };
  }
}