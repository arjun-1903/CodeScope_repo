import * as vscode from 'vscode';
import { OpenAIEmbeddings } from '@langchain/openai';
import { CodeElement } from '../types';

interface Document {
  pageContent: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export class VectorIndex {
  private documents: Document[] = [];
  private isBuilding: boolean = false;
  private embeddings: OpenAIEmbeddings | null = null;

  public async rebuildIndex(elements: CodeElement[]) {
    if (this.isBuilding) { return; }
    
    const config = vscode.workspace.getConfiguration('codescope');
    const apiKey = config.get<string>('openaiApiKey');
    
    if (!apiKey) {
      console.warn("CodeScope AI: No OpenAI API key provided. Embeddings skipped.");
      return;
    }

    try {
      this.isBuilding = true;
      this.embeddings = new OpenAIEmbeddings({ 
        openAIApiKey: apiKey, 
        modelName: "text-embedding-3-small" 
      });

      const docs: Document[] = elements.map(el => {
        const text = `Type: ${el.type}\nName: ${el.name}\nSignature: ${el.signature || 'N/A'}\nDescription: ${el.description || 'none'}\nImplementation:\n${el.context || ''}`;
        return {
          pageContent: text,
          metadata: {
            filePath: el.filePath,
            name: el.name,
            type: el.type,
            startLine: el.startLine,
          }
        };
      });

      // Fetch all embeddings in one highly batched call
      const textToEmbed = docs.map(d => d.pageContent);
      const vectors = await this.embeddings.embedDocuments(textToEmbed);
      
      docs.forEach((doc, i) => {
        doc.embedding = vectors[i];
      });

      this.documents = docs;
      vscode.window.showInformationMessage(`CodeScope AI: ${docs.length} semantic embeddings generated successfully!`);
      
    } catch (e: any) {
      console.error("CodeScope AI: Failed to build vector store", e);
      vscode.window.showErrorMessage(`CodeScope AI Indexing Failed: ${e.message}`);
    } finally {
      this.isBuilding = false;
    }
  }

  public async search(query: string, k: number = 5): Promise<Document[]> {
    if (!this.embeddings || this.documents.length === 0) {
      throw new Error("Vector Store is not initialized. Please ensure your OpenAI API Key is inside the VS Code Settings and the index is built.");
    }
    
    const queryVector = await this.embeddings.embedQuery(query);
    
    // Calculate cosine similarity
    const scoredDocs = this.documents.map(doc => {
      const similarity = this.cosineSimilarity(queryVector, doc.embedding!);
      return { doc, similarity };
    });
    
    scoredDocs.sort((a, b) => b.similarity - a.similarity);
    
    return scoredDocs.slice(0, k).map(scored => scored.doc);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
