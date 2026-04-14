# Fusion Cell — Orbital Landing Page

Framework-free static landing page. A pulsing mint-green orb at the center of the viewport with eight principal-facing modules (Dashboard, Directory, Alerts, Cash Flow, Budgets, Decisions, Holdings, Advanced Search) arranged in orbit around it.

## View

Open `index.html` directly in a browser — no build step.

For a live-reload preview, serve from this directory with any static server:

```
cd fusioncell-site
python3 -m http.server 5173
# then http://localhost:5173
```

## Structure

```
fusioncell-site/
  index.html
  css/
    variables.css   # Brand tokens (colors, fonts, geometry)
    global.css      # Reset, body, CTA section
    orb.css         # Orb, orbit ring math, nodes, animations
  js/
    main.js         # Line rendering, hover wiring, reduced-motion, Lucide init
```

## How it works

- **Layout:** each `.node` uses `transform: rotate(var(--angle)) translate(var(--radius)) rotate(-var(--angle))` to sit on a ring around the orb. No JS positioning.
- **Connecting lines:** a single SVG overlay (`<svg class="orbit-lines">`) with `viewBox="0 0 1000 1000"`. `main.js` renders eight `<line>` elements once at init — they scale with the SVG, so no resize handler is needed.
- **Animations:** orb has a `pulse` keyframe; nodes have a staggered `drift`. Both disabled under `prefers-reduced-motion: reduce`.
- **Responsive:** below 720px the ring collapses — lines hide, nodes reflow into a two-column grid under the orb.
- **Icons:** Lucide via the UMD CDN build, initialized once on load.

## Phase 1 scope

Static visual only. No routing, no backend, no form. "Start a Conversation" is a `mailto:` placeholder.
