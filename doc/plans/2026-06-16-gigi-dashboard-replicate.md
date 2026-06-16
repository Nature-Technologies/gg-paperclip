# Implementation Plan: Replicating GIGI Dashboard Mockup in gg-ui

This document outlines the plan to update the UI/UX of the `gg-ui` dashboard to replicate `gigi-dashboard-mockup_FINAL.html`. It establishes two visual modes—**Owner view** (light, calm, plain-language, serif headers) and **Operator view** (dark, dense, technical, monospace/sans-serif)—while maintaining the existing folder structure and underlying React component state.

---

## 1. Scope and Design Alignment

### Fonts & Typography
- **Google Fonts Import**: Load `Fraunces`, `Inter`, and `IBM Plex Mono` in `gg-ui/index.html`.
- **CSS Variables**: Apply the mockup's variable maps:
  - `--display`: `"Fraunces", Georgia, serif`
  - `--body`: `"Inter", system-ui, sans-serif`
  - `--mono`: `"IBM Plex Mono", ui-monospace, monospace`

### Color Palette (Dual Moods)
- **Owner Mode (`mode-owner`)**:
  - Background: `--o-canvas` (`#FBFAF5`)
  - Surface: `--o-surface` (`#FFFFFF`)
  - Ink: `--o-ink` (`#1E241F`)
  - Muted: `--o-muted` (`#6C7268`)
  - Accent Green: `--o-green` (`#1F6E43`)
  - Accent Honey: `--o-honey` (`#E2982E`)
- **Operator Mode (`mode-operator`)**:
  - Background: `#0E1411`
  - Text: `#D6DDD7`
  - Topbar & Sidebar: `#121A16`
  - Cards & Tables: `#141D18`
  - Highlights: `#4fd089` (Green), `#ef8472` (Red), `#e6b958` (Honey)

---

## 2. Technical Steps

### Step 2.1: index.html Updates
- Add preconnect and link tags to import:
  `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;450;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap`

### Step 2.2: ThemeContext Enhancements
- Modify `gg-ui/src/context/ThemeContext.tsx` to support `viewMode` state:
  - Add state: `viewMode: "owner" | "operator"`
  - Persist `viewMode` in `localStorage`
  - Map `viewMode === "owner"` to the light theme, and `viewMode === "operator"` to the dark theme.
  - Apply class names `mode-owner` / `mode-operator` and attribute `data-mode` to `document.body` accordingly.
  - Implement a toggle helper: `toggleViewMode()`.

### Step 2.3: CSS Integrations in index.css
- Append the full stylesheet rules from the mockup to the end of `gg-ui/src/index.css` (e.g. `.brand`, `.mode-toggle`, `.stat`, `.num`, `.tbl`, `.badge.b-*`, `.fnode`, `.rec`, `.log`, `.opcard`).
- Apply these custom layout styles conditionally depending on the `.mode-owner` and `.mode-operator` classes.

### Step 2.4: Layout Shell (Layout.tsx)
- Re-architect the Layout to look exactly like the mockup:
  - **Header**:
    - Add logo (`G`), title (`GIGI`), and subtitle (`Gummy Gardens Marketing OS`).
    - Integrate the Mode Toggle group: "Owner view" vs "Operator view" which calls `setViewMode`.
    - Add "Dev notes" toggle switch which toggles the `show-devnotes` class on `document.body`.
    - Render user initials/avatar at the far right.
  - **Sidebar**:
    - Update `Sidebar.tsx` to render different sidebar items based on `viewMode`:
      - **Owner Nav**: Overview, Strategic Tasks, Task Detail, Agent Workflow, Marketing Performance, Task Performance, Approvals, Blockers, Reports, AI Recommendations.
      - **Operator Nav**: Execution, Agent Management, Approval Queue, Integrations, Execution Logs, Master Task Creation, Role Management.

### Step 2.5: Page Redesigns

#### Dashboard.tsx
- Conditionally render two layouts:
  - **Owner view (`o-overview`)**:
    - Good afternoon greeting header.
    - Stat grid (Active strategic tasks, Pending approvals, Blocked actions, Revenue impact).
    - Grid with organic growth mini-chart (via SVG path matching the mockup) and GIGI's AI Recommendations.
    - Strategic Tasks table with progress bars (`.barwrap` / `.bar`) and badge statuses.
  - **Operator view (`op-exec`)**:
    - Stat grid (Running subtasks, Approval queue, Integration blockers, Agent calls).
    - Subtask assignment table with trace links.

#### Issues / Tasks Pages (`Issues.tsx`, `IssueDetail.tsx`)
- Render issues styled as "Strategic Tasks" (using the mockup's table structure and styles).
- In Owner view of `IssueDetail.tsx`, render "What GIGI understood", At-a-glance KPI checklist, and assigned agents. Include Dev notes block at the bottom.
- In Operator view, render "Master Task Creation" form inputs, autonomy levels, KPI inputs, and guardrails.

#### Agents Pages (`Agents.tsx`, `AgentDetail.tsx`)
- Render agent list as cards matching the mockup's `.agent-card` styling.
- Render model chip labels, status badges, and mini stats (Calls 24h, Success %).
- Operator agent detail: edit model configuration, system prompt/persona, tools selection.

#### Approvals Page (`Approvals.tsx`)
- Render the preview cards, content fields (Channel, Strategic Task, Suggested go-live), and green/soft/danger button groups.

#### Costs & Reports (`Costs.tsx`, `Artifacts.tsx`)
- Render a downloads grid (`.rep-grid`) with options for PDF, Excel, Google Sheets, PPT format icons.

---

## 3. Verification Plan

1. **Vite Live Server**:
   - Ensure the server starts successfully on port 3101+ as described in `AGENTS.md`.
2. **Interactive Elements**:
   - Verify view switching (Owner mode toggle to Operator mode toggle changes colors, layouts, sidebars, and fonts dynamically).
   - Test "Dev notes" toggle.
3. **Visual Aesthetics**:
   - Use the browser subagent to verify color accuracy, font loading, card spacing, and responsiveness.
