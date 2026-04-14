import * as vscode from 'vscode';
import { SearchCommand } from './commands/searchCommand';
import { ChatPanel } from './ui/chatPanel';
import { RagService } from './ai/ragService';

let searchCommand: SearchCommand;

export function activate(context: vscode.ExtensionContext) {
	console.log('CodeScope extension is now active!');

	searchCommand = new SearchCommand();

	const searchDisposable = vscode.commands.registerCommand('codescope.search', async () => {
		try {
			await searchCommand.execute();
		} catch (error) {
			vscode.window.showErrorMessage(`CodeScope search failed: ${error}`);
		}
	});

	const refreshDisposable = vscode.commands.registerCommand('codescope.refresh', async () => {
		try {
			await searchCommand.refreshIndex();
		} catch (error) {
			vscode.window.showErrorMessage(`CodeScope refresh failed: ${error}`);
		}
	});

	const openChatDisposable = vscode.commands.registerCommand('codescope.openChat', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('CodeScope AI requires an open workspace.');
			return;
		}
		
		await searchCommand.ensureIndexed(workspaceFolders);
		
		const ragService = new RagService(searchCommand.getIndexer().vectorIndex);
		ChatPanel.createOrShow(ragService);
	});

	context.subscriptions.push(searchDisposable, refreshDisposable, openChatDisposable);
}

export function deactivate() {
	if (searchCommand) {
		searchCommand.dispose();
	}
}
