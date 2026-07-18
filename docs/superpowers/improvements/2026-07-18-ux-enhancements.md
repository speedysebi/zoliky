# Žolíky UX Enhancements Plan

**Date:** 2026-07-18  
**Scope:** Three visual + interaction improvements to make the game more polished and intuitive.

---

## Improvement 1: Better Card Deck Design

**Goal:** Replace the plain card rendering with a nicer SVG or styled deck design.

**Current state:** Cards are plain divs with rank/suit symbols (e.g., "9♥").

**Options to research:**
- **SVG card library:** Look for open-source card deck designs (PlayingCardJS, SVG-playing-cards, or hand-drawn modern deck)
- **CSS + Unicode:** Enhance current cards with better styling, shadows, borders, maybe a subtle gradient or texture
- **Web font:** Use a card suit Unicode font for prettier symbols
- **Image sprites:** Use CSS background-image with a card sprite sheet

**Recommended approach:** Use an open-source SVG card deck (e.g., from GitHub) as data URIs or inline SVG in the component. This keeps the game LAN-only with no external requests.

**Files to modify:**
- `client/src/cardUtils.js` — export card SVG or CSS class names
- `client/src/components/Hand.jsx` — render SVG instead of plain divs
- `client/src/components/Table.jsx` — update meld card rendering
- `client/src/components/MeldsStrip.jsx` — update meld display

---

## Improvement 2: Drag-and-Drop Hand Reordering

**Goal:** Let players drag cards within their hand to reorder them for melding strategy.

**Current state:** Cards are clickable (toggle selection), but order is fixed from server.

**Implementation:**
- Use `react-beautiful-dnd` or `@dnd-kit/core` for drag-and-drop
- Local state tracks reordered hand (doesn't send to server; just visual)
- When player stages a meld, use the reordered indices
- No change to game logic (server never sees hand order)

**Files to modify:**
- `client/src/components/Hand.jsx` — wrap with drag-drop provider, make cards draggable
- `client/src/components/Table.jsx` — pass reorder callback to Hand

---

## Improvement 3: Closing Card Horizontal + Prominent

**Goal:** Make the closing card visually distinct: place it horizontally (rotated 90°) so it "sticks out like a sore thumb" from the deck.

**Current state:** Closing card is vertical, peeking beneath the deck stack.

**Implementation:**
- Move closing card beside (not beneath) the deck
- Rotate it 90° (CSS `transform: rotate(90deg)`)
- Add styling to make it pop: glow, border, maybe a label ("CLOSING")

**Files to modify:**
- `client/src/components/Table.jsx` — adjust layout in `.center-area`
- `client/src/styles.css` — add `.closing-card` class with rotation and styling

---

## Research tasks

1. **Card deck design:** Find a good open-source SVG deck or create a minimal styled version.
   - Check: https://github.com/topics/playing-cards
   - Consider: Deck width/height to fit in existing layout (current cards are 46×64px)

2. **Drag-and-drop library:** Decide on `react-beautiful-dnd`, `@dnd-kit`, or custom HTML5 drag-drop.
   - `@dnd-kit` is lighter and more modern
   - HTML5 native is simplest if we keep it simple

3. **Closing card styling:** Check if current dimensions work rotated (54×76px → will be 76px wide, 54px tall when rotated).

---

## Execution order

1. Research + finalize card deck design
2. Implement drag-and-drop in Hand.jsx
3. Style and position closing card
4. Test end-to-end in browser
5. Run full test suite (npm test)
6. No new commits unless explicitly requested

---

## Risk assessment

- **Card design:** Low risk; purely visual, no game logic change
- **Drag-and-drop:** Low risk; local state only, no server impact
- **Closing card layout:** Medium risk; layout change might affect responsive design on mobile
