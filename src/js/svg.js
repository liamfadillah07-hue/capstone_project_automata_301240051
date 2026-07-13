/* svg.js — lightweight SVG renderers for automaton diagrams and parse trees.
   No external libraries; pure DOM/SVG string building. */

(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}, children = []) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    for (const c of children) e.appendChild(c);
    return e;
  }

  /** Render an automaton (states + transitions) as an SVG diagram inside `container`. */
  function renderAutomaton(container, fsa, highlightStates = new Set()) {
    container.innerHTML = '';
    const states = fsa.states;
    const n = states.length;
    const W = Math.max(560, n * 130);
    const H = 380;
    const cx = W / 2, cy = H / 2 - 10;
    const R = Math.min(W, H) / 2 - 70;
    const pos = {};
    states.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      pos[s] = { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
    });

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'automaton-svg' });

    const defs = el('defs', {}, [
      el('marker', { id: 'arrow', markerWidth: 10, markerHeight: 10, refX: 9, refY: 3, orient: 'auto', markerUnits: 'strokeWidth' }, [
        el('path', { d: 'M0,0 L0,6 L9,3 z', fill: 'var(--edge)' }),
      ]),
    ]);
    svg.appendChild(defs);

    // group transitions by (from,to) pair to combine labels & handle self loops / bidirectional curve offset
    const pairLabels = {};
    for (const [key, targets] of Object.entries(fsa.transitions)) {
      const [from, sym] = key.split('|');
      for (const to of targets) {
        const pk = `${from}=>${to}`;
        pairLabels[pk] = pairLabels[pk] || { from, to, syms: [] };
        pairLabels[pk].syms.push(sym);
      }
    }

    const edgesLayer = el('g', { class: 'edges' });
    const nodeR = 26;
    for (const { from, to, syms } of Object.values(pairLabels)) {
      const p1 = pos[from], p2 = pos[to];
      if (!p1 || !p2) continue;
      const label = syms.join(', ');
      if (from === to) {
        // self loop above the node
        const loopPath = `M ${p1.x - 16} ${p1.y - nodeR} C ${p1.x - 40} ${p1.y - nodeR - 55}, ${p1.x + 40} ${p1.y - nodeR - 55}, ${p1.x + 16} ${p1.y - nodeR}`;
        edgesLayer.appendChild(el('path', { d: loopPath, fill: 'none', stroke: 'var(--edge)', 'stroke-width': 1.6, 'marker-end': 'url(#arrow)' }));
        edgesLayer.appendChild(el('text', { x: p1.x, y: p1.y - nodeR - 58, class: 'edge-label', 'text-anchor': 'middle' }, [document.createTextNode(label)]));
        continue;
      }
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / dist, uy = dy / dist;
      const sx = p1.x + ux * nodeR, sy = p1.y + uy * nodeR;
      const exArrow = p2.x - ux * (nodeR + 8), eyArrow = p2.y - uy * (nodeR + 8);
      const mx = (sx + exArrow) / 2 - uy * 22, my = (sy + eyArrow) / 2 + ux * 22;
      const path = `M ${sx} ${sy} Q ${mx} ${my} ${exArrow} ${eyArrow}`;
      edgesLayer.appendChild(el('path', { d: path, fill: 'none', stroke: 'var(--edge)', 'stroke-width': 1.6, 'marker-end': 'url(#arrow)' }));
      edgesLayer.appendChild(el('text', { x: mx, y: my - 6, class: 'edge-label', 'text-anchor': 'middle' }, [document.createTextNode(label)]));
    }
    svg.appendChild(edgesLayer);

    const nodesLayer = el('g', { class: 'nodes' });
    states.forEach(s => {
      const { x, y } = pos[s];
      const isFinal = fsa.finals.includes(s);
      const isStart = s === fsa.start;
      const isActive = highlightStates.has(s);
      const g = el('g', {});
      if (isStart) {
        g.appendChild(el('path', { d: `M ${x - nodeR - 34} ${y} L ${x - nodeR - 4} ${y}`, stroke: 'var(--edge)', 'stroke-width': 1.6, 'marker-end': 'url(#arrow)' }));
      }
      g.appendChild(el('circle', { cx: x, cy: y, r: nodeR, class: `state-circle${isActive ? ' active' : ''}` }));
      if (isFinal) g.appendChild(el('circle', { cx: x, cy: y, r: nodeR - 5, class: 'state-circle-inner' }));
      g.appendChild(el('text', { x, y: y + 5, class: 'state-label', 'text-anchor': 'middle' }, [document.createTextNode(s)]));
      nodesLayer.appendChild(g);
    });
    svg.appendChild(nodesLayer);

    container.appendChild(svg);
  }

  /** Render a CFG parse tree recursively. */
  function renderParseTree(container, root) {
    container.innerHTML = '';
    // compute layout via simple recursive width assignment
    let leafCounter = 0;
    const levelHeight = 64;
    function layout(node, depth) {
      if (!node.children || node.children.length === 0) {
        node._x = leafCounter++;
        node._depth = depth;
        return;
      }
      node._depth = depth;
      for (const c of node.children) layout(c, depth + 1);
      const xs = node.children.map(c => c._x);
      node._x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    layout(root, 0);

    const maxDepth = Math.max(...collectDepths(root));
    const W = Math.max(500, (leafCounter) * 70);
    const H = (maxDepth + 1) * levelHeight + 40;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'tree-svg' });

    const edges = el('g');
    const nodes = el('g');

    function xPix(node) { return 40 + node._x * 70; }
    function yPix(node) { return 30 + node._depth * levelHeight; }

    function draw(node) {
      const x = xPix(node), y = yPix(node);
      if (node.children && node.children.length) {
        for (const c of node.children) {
          edges.appendChild(el('line', { x1: x, y1: y + 14, x2: xPix(c), y2: yPix(c) - 14, stroke: 'var(--edge)', 'stroke-width': 1.4 }));
          draw(c);
        }
      }
      const isLeaf = !node.children || node.children.length === 0;
      const label = node.symbol === 'ε' ? 'ε' : node.symbol;
      nodes.appendChild(el('circle', { cx: x, cy: y, r: 16, class: isLeaf ? 'tree-leaf' : 'tree-node' }));
      nodes.appendChild(el('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'tree-label' }, [document.createTextNode(label)]));
    }
    draw(root);

    svg.appendChild(edges);
    svg.appendChild(nodes);
    container.appendChild(svg);
  }

  function collectDepths(node, acc = []) {
    acc.push(node._depth || 0);
    if (node.children) for (const c of node.children) collectDepths(c, acc);
    return acc;
  }

  window.SVGViz = { renderAutomaton, renderParseTree };
})();
