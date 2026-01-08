# Design Guidelines: Saved Knowledge Chat Chrome Extension

## Design Approach: Trust-First Productivity System

**Selected Approach**: Design System (Fluent Design + Linear-inspired clarity)

**Rationale**: This is a precision tool for professionals where trust, clarity, and information density are paramount. The design must feel reliable, focused, and efficient—not decorative.

**Core Principles**:
- Information hierarchy over visual flourish
- Trust signals embedded in every interaction
- Scannable, dense layouts (Chrome popup constraints)
- Professional restraint

---

## Typography

**Font Family**: 
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for URLs, timestamps)

**Hierarchy**:
- Extension title/header: text-base font-semibold
- Section headers: text-sm font-medium uppercase tracking-wide text-gray-500
- Snippet text: text-sm leading-relaxed
- Metadata (domains, timestamps): text-xs font-medium
- Chat messages: text-sm leading-normal
- Citations: text-xs text-gray-600

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 3, 4, 6, 8** (e.g., p-4, gap-3, space-y-6)

**Container Structure**:
- Popup width: Fixed at 400px (Chrome extension standard)
- Popup height: max-h-[600px] with scroll
- Inner padding: p-4 consistently
- Section spacing: space-y-6
- Card spacing: space-y-3

**Grid Pattern**: 
- Single column for snippets (popup constraints)
- Two-column for metadata pairs (domain | timestamp)

---

## Component Library

### Core Components

**Snippet Card**:
- Border with subtle shadow (border rounded-lg)
- Padding: p-4
- Hover state: slight border color shift
- Structure: Snippet text → metadata row → source URL
- Truncation: line-clamp-3 for preview, expandable on click

**Chat Interface**:
- Input field: Sticky bottom with border-t
- Message bubbles: Rounded, distinct user vs. system styling
- Citation blocks: Nested cards with reduced padding (p-3)
- Thread switcher: Compact tabs at top

**Progress Counter**:
- Prominent position below header
- Format: "X insights across Y domains"
- Typography: text-sm font-medium with accent color for numbers

**Recent Saves List**:
- Scrollable area with max-h-[400px]
- Each item: Compact card with hover effect
- Visual separator: border-b for last item only

**Source Citations** (Expandable):
- Collapsed: Show count badge "3 sources"
- Expanded: Accordion-style snippet cards with reduced scale
- Visual connector: Subtle left border indicating relationship

### Navigation

**Primary Actions**:
- "Save" button: Full-width, prominent (when text selected)
- "New Chat" button: Icon + text, top-right position
- Thread selector: Dropdown or compact tabs

**Secondary Actions**:
- Delete (trash icon): Icon-only, positioned on hover
- Expand/collapse: Chevron icons, consistent direction

### Form Elements

**Chat Input**:
- Multi-line textarea with auto-resize (max 4 lines)
- Send button: Icon-only, positioned inline-end
- Placeholder: "Ask about your saved knowledge..."

**Search/Filter** (if added):
- Single-line input with search icon
- Position: Below header, above content

### Overlays

**Confirmation Messages**:
- Toast-style at bottom: "Saved" with checkmark icon
- Duration: 2s auto-dismiss
- Undo action (for deletion): Inline link within toast

**Empty States**:
- Centered content with icon
- Primary message: "No saved snippets yet"
- Secondary CTA: Brief usage hint

**Loading States**:
- Skeleton screens for snippet cards
- Spinner for chat responses (with "Searching your knowledge..." text)
- Progress indicator for multi-step operations

---

## Trust & Transparency Signals

**Visual Indicators**:
- Source URL always visible (not hidden)
- Timestamp in relative format ("2 days ago")
- Citation count badges prominently displayed
- "No data" states explicit and clear, never hidden

**Information Density**:
- Maximize vertical space efficiency
- Use compact metadata rows
- Truncate intelligently with clear expansion affordances

---

## Interaction Patterns

**Minimal Animation**:
- Smooth height transitions for expand/collapse (150ms)
- Subtle hover states (border/background shifts)
- No decorative animations

**Feedback**:
- Instant visual confirmation for all saves
- Loading states for chat queries
- Error messages: Human-readable, positioned contextually

---

## Images

**No images required** for this Chrome extension. The interface is purely functional with text, icons, and data visualization. All visual interest comes from:
- Typography hierarchy
- Spacing rhythm  
- Border treatments
- Subtle shadows for depth

Use **Heroicons** (outline style) for all iconography via CDN.