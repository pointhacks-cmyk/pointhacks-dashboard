# UPGRADE-LOG.md

## Agent 2 — Chat Persistence & Streaming (2026-03-03)

### Changes

**1. Chat Thread Persistence (localStorage)**
- `src/app/chat/page.tsx` — Full rewrite of thread management
  - Threads stored in localStorage under key `ph-chat-threads`
  - Schema: `[{id, title, messages[], history[], createdAt, updatedAt}]`
  - Auto-generates title from first user message (first 50 chars)
  - Left sidebar shows thread list with time labels
  - "New Chat" button creates fresh thread
  - Click thread to switch (remounts ChatInterface with `key` prop)
  - X button on hover to delete threads
  - Conversation history (API messages array) persisted per thread for context continuity
  - `onMessagesChange` callback from ChatInterface syncs state upward

**2. Streaming Responses**
- `src/app/api/chat/route.ts` — Hybrid streaming architecture
  - Tool-use loop runs non-streaming (tools need full JSON responses)
  - Final text response re-requested with `stream: true`
  - Anthropic SSE events parsed, `content_block_delta` text chunks piped to client via `ReadableStream`
  - Response sent as `text/plain` with chunked transfer encoding
  - Falls back to JSON response if streaming fails
- `src/components/ChatInterface.tsx` — Stream consumer
  - Detects `text/plain` content-type → reads stream via `ReadableStream.getReader()`
  - Accumulates chunks into `streamingContent` state, rendered live
  - Blinking teal cursor (`streaming-cursor` CSS) while streaming
  - Bouncing dots shown during tool-use phase (before text starts)
  - Falls back to JSON parsing for non-streaming responses

**3. UI Polish**
- **Copy button**: Appears on hover over any message bubble (user or assistant). Uses Lucide `Copy`/`Check` icons with 2s feedback.
- **Code blocks**: Fenced code blocks (```` ```lang ```) render with dark background, language label header, monospace font, and scrollable overflow. Inline code styled with subtle background.
- **Timestamps**: Every message shows time in `HH:MM` format (en-AU locale). Handles both Date objects and ISO strings from localStorage.

### Files Modified
- `src/app/api/chat/route.ts` — Streaming response pipeline
- `src/components/ChatInterface.tsx` — Stream consumer, copy buttons, code styling, persistence callbacks
- `src/app/chat/page.tsx` — localStorage thread management, delete threads, thread switching

### Design Compliance
- Colors: navy #003399, teal #5FD6BF used for cursor/accents
- Dark theme glass-card aesthetic maintained
- No emojis — Lucide icons only (Copy, Check, X, MessageSquarePlus, etc.)
