import * as vscode from 'vscode';
import { ChatOpenAI } from '@langchain/openai';
import { VectorIndex } from './vectorIndex';

export class RagService {
  constructor(private vectorIndex: VectorIndex) {}

  public async getAnswer(query: string, reportProgress: (msg: string) => void): Promise<string> {
    const config = vscode.workspace.getConfiguration('codescope');
    const apiKey = config.get<string>('openaiApiKey');
    
    if (!apiKey) {
      return "Error: CodeScope AI requires an OpenAI API key. Please add it to your VS Code Settings.";
    }

    try {
      reportProgress("Extracting semantic intent...");
      // 1. Retrieve context
      const docs = await this.vectorIndex.search(query, 5);
      
      if (!docs || docs.length === 0) {
        return "I couldn't find any relevant code in your workspace to answer that question.";
      }

      reportProgress(`Found ${docs.length} relevant code chunks. Formulating answer...`);

      // 2. Format context
      const contextText = docs.map((doc, i) => {
        return `--- Chunk ${i + 1} (From ${doc.metadata.filePath}) ---\n${doc.pageContent}\n`;
      }).join('\n');

      // 3. Initialize LLM
      const llm = new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: "gpt-4o-mini",
        temperature: 0.1
      });

      // 4. Call Model
      const prompt = `You are an expert AI developer assistant inside an IDE. 
You are answering a question about the user's localized codebase. 
Use the provided code implementation chunks to answer the user's question accurately.
Include markdown code blocks where helpful, and cite the file names you referenced.

Code Context:
${contextText}

User Question: ${query}`;

      const response = await llm.invoke([{ role: 'user', content: prompt }]);
      return response.content as string;

    } catch (e: any) {
      console.error("RAG Error:", e);
      return `Error generating response: ${e.message}`;
    }
  }
}
