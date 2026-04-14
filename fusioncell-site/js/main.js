// Fusion Cell — orbital landing page
// - Renders connecting lines between orb center and each node
// - Wires hover state on a node to highlight its matching line
// - Honors prefers-reduced-motion
// - Initializes Lucide icons (loaded via CDN in index.html)

(function () {
  const NODES = Array.from(document.querySelectorAll('.node'));
  const svg = document.querySelector('.orbit-lines');

  // 1. Build faint connecting lines from center to each node angle.
  if (svg && NODES.length) {
    const size = 1000; // viewBox is 0 0 1000 1000; lines scale with the SVG
    const cx = size / 2;
    const cy = size / 2;
    const orbR = 80;   // keep line off the orb
    const nodeR = 420; // stop short of the node card
    const frag = document.createDocumentFragment();

    NODES.forEach((node, i) => {
      const angleDeg = parseFloat(node.style.getPropertyValue('--angle'));
      const rad = (angleDeg * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * orbR;
      const y1 = cy + Math.sin(rad) * orbR;
      const x2 = cx + Math.cos(rad) * nodeR;
      const y2 = cy + Math.sin(rad) * nodeR;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'orbit-line');
      line.setAttribute('data-i', String(i));
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      frag.appendChild(line);
    });

    svg.appendChild(frag);
  }

  // 2. Hover wiring: highlight matching line.
  NODES.forEach((node, i) => {
    const line = svg && svg.querySelector(`.orbit-line[data-i="${i}"]`);
    if (!line) return;
    const on = () => line.classList.add('hot');
    const off = () => line.classList.remove('hot');
    node.addEventListener('mouseenter', on);
    node.addEventListener('mouseleave', off);
    node.addEventListener('focusin', on);
    node.addEventListener('focusout', off);
  });

  // 3. Orb = Advanced Search entry point. Phase 1 has no search UI, so this
  //    is a placeholder — the real handler will open the search modal later.
  const orb = document.getElementById('orb-search');
  if (orb) {
    orb.addEventListener('click', () => {
      // TODO: replace with real Advanced Search modal.
      console.info('[Fusion Cell] Advanced Search invoked');
    });
  }

  // 4. Reduced motion: belt-and-braces flag on <body> for CSS.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('reduced');
  }

  // 5. Lucide icons — the UMD build exposes window.lucide.
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
})();
