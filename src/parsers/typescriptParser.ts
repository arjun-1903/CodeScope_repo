import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { CodeElement, ElementType, Parameter, ParsedFile, ParseError, ParserOptions, Language } from '../types';

export class TypeScriptParser {
  private options: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.options = {
      includeComments: true,
      includePrivate: false,
      maxDepth: 10,
      excludePatterns: [],
      ...options
    };
  }

  public async parseFile(filePath: string): Promise<ParsedFile> {
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const elements: CodeElement[] = [];
    const errors: ParseError[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    this.visitNode(sourceFile, elements, errors, imports, exports);

    return {
      filePath,
      language: this.getLanguage(filePath),
      elements,
      imports,
      exports,
      errors
    };
  }

  private getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.ts' || ext === '.tsx' ? Language.TYPESCRIPT : Language.JAVASCRIPT;
  }

  private visitNode(
    node: ts.Node,
    elements: CodeElement[],
    errors: ParseError[],
    imports: string[],
    exports: string[],
    depth: number = 0,
    parentName?: string
  ): void {
    if (depth > (this.options.maxDepth || 10)) {
      return;
    }

    let nextParentName = parentName;
    if (ts.isClassDeclaration(node) && node.name) {
      nextParentName = node.name.text;
    } else if (ts.isInterfaceDeclaration(node)) {
      nextParentName = node.name.text;
    }

    switch (node.kind) {
      case ts.SyntaxKind.FunctionDeclaration:
        this.processFunctionDeclaration(node as ts.FunctionDeclaration, elements, parentName);
        break;
      case ts.SyntaxKind.ClassDeclaration:
        this.processClassDeclaration(node as ts.ClassDeclaration, elements);
        break;
      case ts.SyntaxKind.MethodDeclaration:
      case ts.SyntaxKind.MethodSignature:
        this.processMethodDeclaration(node, elements, parentName);
        break;
      case ts.SyntaxKind.PropertyDeclaration:
      case ts.SyntaxKind.PropertySignature:
        this.processPropertyDeclaration(node, elements, parentName);
        break;
      case ts.SyntaxKind.VariableDeclaration:
        this.processVariableDeclaration(node as ts.VariableDeclaration, elements, parentName);
        break;
      case ts.SyntaxKind.InterfaceDeclaration:
        this.processInterfaceDeclaration(node as ts.InterfaceDeclaration, elements);
        break;
      case ts.SyntaxKind.TypeAliasDeclaration:
        this.processTypeAliasDeclaration(node as ts.TypeAliasDeclaration, elements);
        break;
      case ts.SyntaxKind.EnumDeclaration:
        this.processEnumDeclaration(node as ts.EnumDeclaration, elements);
        break;
      case ts.SyntaxKind.ImportDeclaration:
        this.processImportDeclaration(node as ts.ImportDeclaration, imports);
        break;
      case ts.SyntaxKind.ExportDeclaration:
        this.processExportDeclaration(node as ts.ExportDeclaration, exports);
        break;
    }

    ts.forEachChild(node, child => 
      this.visitNode(child, elements, errors, imports, exports, depth + 1, nextParentName)
    );
  }

  private processFunctionDeclaration(node: ts.FunctionDeclaration, elements: CodeElement[], parentName?: string): void {
    if (!node.name) {return;}

    const position = this.getPosition(node);
    const parameters = this.extractParameters(node.parameters);
    const returnType = this.getReturnType(node);
    const modifiers = this.getModifiers(node);
    const description = this.getDescription(node);

    if (!this.options.includePrivate && modifiers.includes('private')) {
      return;
    }

    const baseName = node.name.text;
    const fullName = parentName ? `${parentName}.${baseName}` : baseName;

    elements.push({
      name: fullName,
      type: ElementType.FUNCTION,
      signature: this.getFunctionSignature(node),
      description,
      filePath: node.getSourceFile().fileName,
      ...position,
      parameters,
      returnType,
      modifiers,
      context: this.getContext(node)
    });
  }

  private processClassDeclaration(node: ts.ClassDeclaration, elements: CodeElement[]): void {
    if (!node.name) {return;}

    const position = this.getPosition(node);
    const modifiers = this.getModifiers(node);
    const description = this.getDescription(node);

    if (!this.options.includePrivate && modifiers.includes('private')) {
      return;
    }

    elements.push({
      name: node.name.text,
      type: ElementType.CLASS,
      description,
      filePath: node.getSourceFile().fileName,
      ...position,
      modifiers,
      context: this.getContext(node)
    });
  }

  private processMethodDeclaration(node: any, elements: CodeElement[], parentName?: string): void {
    if (!node.name || !ts.isIdentifier(node.name)) {return;}

    const position = this.getPosition(node);
    const parameters = this.extractParameters(node.parameters);
    const returnType = this.getReturnType(node);
    const modifiers = this.getModifiers(node);
    const description = this.getDescription(node);

    if (!this.options.includePrivate && modifiers.includes('private')) {
      return;
    }

    const baseName = node.name.text;
    const fullName = parentName ? `${parentName}.${baseName}` : baseName;

    elements.push({
      name: fullName,
      type: ElementType.METHOD,
      signature: this.getMethodSignature(node),
      description,
      filePath: node.getSourceFile().fileName,
      ...position,
      parameters,
      returnType,
      modifiers,
      context: this.getContext(node)
    });
  }

  private processPropertyDeclaration(node: any, elements: CodeElement[], parentName?: string): void {
    if (!node.name || !ts.isIdentifier(node.name)) {return;}

    const position = this.getPosition(node);
    const modifiers = this.getModifiers(node);
    const description = this.getDescription(node);

    if (!this.options.includePrivate && modifiers.includes('private')) {
      return;
    }

    const baseName = node.name.text;
    const fullName = parentName ? `${parentName}.${baseName}` : baseName;

    elements.push({
      name: fullName,
      type: ElementType.PROPERTY,
      description,
      filePath: node.getSourceFile().fileName,
      ...position,
      returnType: node.type ? node.type.getText() : undefined,
      modifiers,
      context: this.getContext(node)
    });
  }

  private processVariableDeclaration(node: ts.VariableDeclaration, elements: CodeElement[], parentName?: string): void {
    if (!node.name || !ts.isIdentifier(node.name)) {return;}

    const position = this.getPosition(node);
    const description = this.getDescription(node);
    const baseName = node.name.text;
    const fullName = parentName ? `${parentName}.${baseName}` : baseName;

    if (node.initializer && ts.isArrowFunction(node.initializer)) {
      const arrowFunc = node.initializer;
      elements.push({
        name: fullName,
        type: ElementType.FUNCTION,
        signature: `const ${baseName} = (${arrowFunc.parameters.map(p => p.getText()).join(', ')}) => ...`,
        description,
        filePath: node.getSourceFile().fileName,
        ...position,
        parameters: this.extractParameters(arrowFunc.parameters),
        returnType: arrowFunc.type ? arrowFunc.type.getText() : undefined,
        context: this.getContext(node)
      });
    } else {
      elements.push({
        name: fullName,
        type: ElementType.VARIABLE,
        description,
        filePath: node.getSourceFile().fileName,
        ...position,
        returnType: node.type ? node.type.getText() : undefined,
        context: this.getContext(node)
      });
    }
  }

  private processInterfaceDeclaration(node: ts.InterfaceDeclaration, elements: CodeElement[]): void {
    const position = this.getPosition(node);
    const modifiers = this.getModifiers(node);
    const description = this.getDescription(node);

    elements.push({
      name: node.name.text,
      type: ElementType.INTERFACE,
      description,
      filePath: node.getSourceFile().fileName,
      ...position,
      modifiers,
      context: this.getContext(node)
    });
  }

  private processTypeAliasDeclaration(node: ts.TypeAliasDeclaration, elements: CodeElement[]): void {
    const position = this.getPosition(node);
    const modifiers = this.getModifiers(node);
    const description = this.getDescription(node);

    elements.push({
      name: node.name.text,
      type: ElementType.TYPE,
      description,
      filePath: node.getSourceFile().fileName,
      ...position,
      modifiers,
      context: this.getContext(node)
    });
  }

  private processEnumDeclaration(node: ts.EnumDeclaration, elements: CodeElement[]): void {
    const position = this.getPosition(node);
    const modifiers = this.getModifiers(node);
    const description = this.getDescription(node);

    elements.push({
      name: node.name.text,
      type: ElementType.ENUM,
      description,
      filePath: node.getSourceFile().fileName,
      ...position,
      modifiers,
      context: this.getContext(node)
    });
  }

  private processImportDeclaration(node: ts.ImportDeclaration, imports: string[]): void {
    if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
  }

  private processExportDeclaration(node: ts.ExportDeclaration, exports: string[]): void {
    if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      exports.push(node.moduleSpecifier.text);
    }
  }

  private getPosition(node: ts.Node): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return {
      startLine: start.line + 1,
      endLine: end.line + 1,
      startColumn: start.character + 1,
      endColumn: end.character + 1
    };
  }

  private extractParameters(parameters: ts.NodeArray<ts.ParameterDeclaration>): Parameter[] {
    return parameters.map(param => {
      const name = param.name.getText();
      const type = param.type ? param.type.getText() : undefined;
      const optional = !!param.questionToken;
      const defaultValue = param.initializer ? param.initializer.getText() : undefined;

      return { name, type, optional, defaultValue };
    });
  }

  private getReturnType(node: any): string | undefined {
    return node.type ? node.type.getText() : undefined;
  }

  private getModifiers(node: ts.Node): string[] {
    const modifiers: string[] = [];
    if (ts.canHaveModifiers(node)) {
      const nodeModifiers = ts.getModifiers(node);
      if (nodeModifiers) {
        nodeModifiers.forEach(modifier => {
          modifiers.push(ts.SyntaxKind[modifier.kind].toLowerCase());
        });
      }
    }
    return modifiers;
  }

  private getDescription(node: ts.Node): string | undefined {
    if (!this.options.includeComments) {return undefined;}

    const sourceFile = node.getSourceFile();
    const fullText = sourceFile.getFullText();
    const commentRanges = ts.getLeadingCommentRanges(fullText, node.getFullStart());

    if (commentRanges && commentRanges.length > 0) {
      const lastComment = commentRanges[commentRanges.length - 1];
      const commentText = fullText.slice(lastComment.pos, lastComment.end);
      return commentText.replace(/^\/\*\*?|\*\/$/g, '').replace(/^\s*\*\s?/gm, '').trim();
    }

    return undefined;
  }

  private getFunctionSignature(node: ts.FunctionDeclaration): string {
    const name = node.name?.text || '';
    const params = node.parameters.map(p => p.getText()).join(', ');
    const returnType = node.type ? `: ${node.type.getText()}` : '';
    return `function ${name}(${params})${returnType}`;
  }

  private getMethodSignature(node: any): string {
    const name = node.name?.getText() || '';
    const params = node.parameters ? node.parameters.map((p: any) => p.getText()).join(', ') : '';
    const returnType = node.type ? `: ${node.type.getText()}` : '';
    return `${name}(${params})${returnType}`;
  }

  private getContext(node: ts.Node): string {
    const sourceFile = node.getSourceFile();
    const start = Math.max(0, node.getStart() - 100);
    const end = Math.min(sourceFile.getEnd(), node.getEnd() + 100);
    return sourceFile.getText().slice(start, end);
  }
}