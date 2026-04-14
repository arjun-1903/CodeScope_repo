import * as vscode from 'vscode';
import { RagService } from '../ai/ragService';

export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, private ragService: RagService) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getHtmlForWebview();

    this._panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'askQuestion':
          await this.handleQuestion(message.text);
          return;
      }
    }, null, this._disposables);
  }

  public static createOrShow(ragService: RagService) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'codescopeChat',
      'CodeScope AI',
      column || vscode.ViewColumn.One,
      { enableScripts: true }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, ragService);
  }

  private async handleQuestion(question: string) {
    // Echo user's question back
    this._panel.webview.postMessage({ command: 'addMessage', role: 'user', text: question });
    
    // Add pending state
    this._panel.webview.postMessage({ command: 'addMessage', role: 'system', text: 'Thinking...' });

    const answer = await this.ragService.getAnswer(question, (status) => {
      this._panel.webview.postMessage({ command: 'updateStatus', text: status });
    });

    // Remove pending state and add answer
    this._panel.webview.postMessage({ command: 'replaceLastMessage', role: 'assistant', text: answer });
  }

  public dispose() {
    ChatPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getHtmlForWebview() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeScope AI</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 10px; display: flex; flex-direction: column; height: 95vh; }
        #chat-container { flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
        .message { padding: 10px; border-radius: 5px; max-width: 90%; word-wrap: break-word; white-space: pre-wrap; }
        .user-message { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); align-self: flex-end; }
        .assistant-message { background-color: var(--vscode-editorWidget-background); color: var(--vscode-editor-foreground); align-self: flex-start; border: 1px solid var(--vscode-panel-border); }
        .system-message { color: var(--vscode-descriptionForeground); font-style: italic; align-self: center; }
        pre { background-color: var(--vscode-editor-background); padding: 10px; border-radius: 3px; overflow-x: auto; }
        code { font-family: var(--vscode-editor-font-family, monospace); }
        #input-container { display: flex; gap: 10px; }
        input { flex-grow: 1; padding: 10px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; }
        button { padding: 10px 15px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 3px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <div id="chat-container">
      <div class="message assistant-message">Hello! I'm your local CodeScope AI. I've read your codebase. What would you like to know?</div>
    </div>
    <div id="input-container">
        <input type="text" id="prompt-input" placeholder="Ask a question about your code..." />
        <button id="send-btn">Send</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const container = document.getElementById('chat-container');
        const input = document.getElementById('prompt-input');
        const btn = document.getElementById('send-btn');

        function parseMarkdown(text) {
            let parsed = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            // Simple markdown logic
            parsed = parsed.replace(/\\\`\\\`\\n?([\\s\\S]*?)\\\`\\\`/g, '<pre><code>$1</code></pre>');
            parsed = parsed.replace(/\\\`([^\\n]+?)\\\`/g, '<code style="background: rgba(0,0,0,0.2); padding: 2px;">$1</code>');
            parsed = parsed.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
            return parsed;
        }

        function addMessage(role, text) {
            const div = document.createElement('div');
            div.className = 'message ' + role + '-message';
            div.innerHTML = role === 'assistant' ? parseMarkdown(text) : (role === 'user' ? text.replace(/</g, '&lt;') : text);
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        }

        btn.addEventListener('click', () => {
            const text = input.value.trim();
            if (text) {
                vscode.postMessage({ command: 'askQuestion', text });
                input.value = '';
            }
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                btn.click();
            }
        });

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'addMessage') {
                addMessage(msg.role, msg.text);
            } else if (msg.command === 'updateStatus') {
                container.lastElementChild.innerHTML = msg.text;
            } else if (msg.command === 'replaceLastMessage') {
                container.lastElementChild.remove();
                addMessage(msg.role, msg.text);
            }
        });
    </script>
</body>
</html>`;
  }
}
