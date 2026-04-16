# CodeScope

CodeScope is a semantic code search tool for Visual Studio Code. It integrates LangChain and OpenAI's embedding models to enable natural language queries and a local, RAG-based chat interface.

## Features

- **Semantic Code Search**: Use natural language queries to find functions, classes, and methods across the codebase.
- **Contextual Chat**: Interact with a chat interface that understands project context using Retrieval-Augmented Generation (RAG).
- **Semantic Indexing**: Locally index the codebase to provide semantically relevant search results using the OpenAI API.

## Requirements

You need an active OpenAI API Key because the extension uses OpenAI's embedding and GPT models for search and chat generation.

## Extension Settings

CodeScope adds the following settings to the VS Code configuration:

* `codescope.openaiApiKey`: **Required**. Your OpenAI API Key for embeddings and responses.

## Commands and Keybindings

The following commands are available from the Command Palette:

- **CodeScope: Search Code** (`Ctrl+Shift+Alt+F` / `Cmd+Shift+Alt+F` on macOS): Open the semantic code search view.
- **CodeScope: Contextual Chat** (`Ctrl+Shift+Alt+C` / `Cmd+Shift+Alt+C` on macOS): Open the chat pane.
- **CodeScope: Refresh Index**: Refresh the workspace semantic index.

## Release Notes

### 0.0.1

Initial release. Features semantic search capabilities, RAG-based chat, and LangChain setup.
