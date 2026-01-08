# Saved Knowledge Chat

## Overview

A Chrome extension that enables users to save highlighted text from any webpage into a personal knowledge vault, then chat with their saved content using AI-grounded responses. The system prioritizes trust, precision, and citation-backed answers—never inventing information outside what the user has saved.

**Target Users:** Entrepreneurs, working professionals, content creators, indie hackers  
**Core Promise:** Every AI answer is grounded exclusively in your saved snippets with explicit citations

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight client-side routing)
- **State Management:** TanStack React Query for server state, local React state for UI
- **Styling:** Tailwind CSS with shadcn/ui component library (New York style)
- **Build Tool:** Vite with path aliases (@/, @shared/, @assets/)

The frontend is designed to work both as a web application (for development/preview) and as the basis for Chrome extension popup UI. Fixed 400x600px popup constraints inform the dense, information-focused design.

### Backend Architecture
- **Framework:** Express.js with TypeScript
- **API Pattern:** RESTful JSON API at `/api/*` endpoints
- **AI Integration:** OpenAI SDK configured for Replit AI Integrations (custom base URL)
- **Build:** esbuild for production bundling with selective dependency inclusion

Key API endpoints:
- `GET/POST/DELETE /api/snippets` - CRUD for saved text snippets
- `GET/POST/DELETE /api/threads` - Chat conversation management
- `POST /api/chat` - AI chat with retrieval from saved snippets

### Chrome Extension Architecture
- **Manifest V3** with Chrome Side Panel API
- **Side Panel:** Full chat interface with three tabs (Chat, Snippets, History)
  - Chat tab: Multi-threaded AI conversations with citations
  - Snippets tab: Search, copy, delete with 5-minute undo
  - History tab: Thread management (create, switch, delete)
- **Content Script:** 
  - Floating save button appears on text selection
  - Keyboard shortcut (Ctrl/Cmd+Shift+S) support
  - Right-click context menu "Save to Knowledge Vault"
- **Background Service Worker:** 
  - Opens side panel on extension icon click
  - Handles API calls with queue management and retry logic
  - Broadcasts save results to all contexts
- **Storage:** Chrome session storage for save queue, local storage for last thread

Extension components communicate via Chrome messaging API. Build: `cd extension && npx tsx build.ts` outputs to `/extension/dist/`.

### Data Layer
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Schema Location:** `/shared/schema.ts` (shared between client and server)
- **Migrations:** Drizzle Kit with `db:push` for schema sync

Core entities:
- **Snippets:** Saved text with source URL, domain, timestamp, auto-tags
- **Threads:** Chat conversation containers
- **Messages:** Individual chat messages with role and content
- **PendingDeletion:** Soft-delete support for undo functionality

### Retrieval Strategy
Text similarity using TF-IDF-like tokenization (no vector embeddings in MVP). The AI is strictly constrained to only answer using retrieved snippets—if no relevant data exists, it explicitly says so rather than using pretrained knowledge.

## External Dependencies

### AI Services
- **OpenAI API** via Replit AI Integrations
  - Environment: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - Used for: Chat completions grounded in retrieved snippets, image generation

### Database
- **PostgreSQL** (provisioned via Replit)
  - Environment: `DATABASE_URL`
  - Connection: Direct via Drizzle ORM

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `openai` - AI API client
- `express` / `express-session` - HTTP server
- `@tanstack/react-query` - Async state management
- `@radix-ui/*` - Accessible UI primitives (via shadcn/ui)
- `p-limit` / `p-retry` - Rate limiting and retry logic for batch operations

### Chrome Extension APIs
- `chrome.sidePanel` - Side panel UI management
- `chrome.storage.session` - Queue persistence
- `chrome.storage.local` - User preferences (last thread)
- `chrome.contextMenus` - Right-click save action
- `chrome.runtime.sendMessage` - Component communication