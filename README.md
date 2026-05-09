# CodeScope
CodeScope is a semantic code search and contextual code understanding tool for Visual Studio Code.

Instead of relying only on keyword matching or blindly chunking files for embeddings, CodeScope parses repositories using the TypeScript Compiler API and indexes functions, classes, and methods individually to improve retrieval quality.

The project started as an experiment to see whether semantic retrieval improves when embeddings are aligned to actual code structure rather than arbitrary text chunks.

## Features

- Semantic code search using natural language
- Context-aware repository chat using RAG
- Structural parsing of functions/classes/methods
- Local vector indexing using cosine similarity
- Lightweight setup without external vector databases
- VS Code integration

## Requirements

You need an active OpenAI API Key because the extension uses OpenAI's embedding and GPT models for search and chat generation.

## Why I built this

I got frustrated with how difficult it was to navigate unfamiliar codebases using traditional keyword search. Most tools either relied on string matching or chunked files blindly, which often destroyed structural context.

CodeScope was built to experiment with structure-aware semantic retrieval for developer workflows.

## Key Insight

The biggest improvement came from indexing around actual code boundaries like functions and classes instead of arbitrary text chunks, which significantly improved retrieval relevance.

## Extension Settings

CodeScope adds the following settings to the VS Code configuration:

* `codescope.openaiApiKey`: **Required**. Your OpenAI API Key for embeddings and responses.

## Commands and Keybindings

The following commands are available from the Command Palette:

- **CodeScope: Search Code** (`Ctrl+Shift+Alt+F` / `Cmd+Shift+Alt+F` on macOS): Open the semantic code search view.
- **CodeScope: Contextual Chat** (`Ctrl+Shift+Alt+C` / `Cmd+Shift+Alt+C` on macOS): Open the chat pane.
- **CodeScope: Refresh Index**: Refresh the workspace semantic index.

## Architecture:
- Code parsing → embedding generation → vector storage → retrieval → LLM response

## Indexing:
- Uses OpenAI embeddings for semantic similarity
- Stores vectors locally for fast retrieval

## Retrieval:
- Top-k semantic matching of code snippets

## Example
Query: "function to calculate interest"
→ returns relevant code blocks
→ LLM explains logic

## Release Notes

### 0.0.1

Initial release. Features semantic search capabilities, RAG-based chat, and LangChain setup.
