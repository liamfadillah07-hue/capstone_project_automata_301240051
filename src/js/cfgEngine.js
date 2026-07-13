/* cfgEngine.js — leftmost derivation search (bounded), parse-tree construction,
   and a standard CFG-to-PDA (single state, empty-stack acceptance) trace simulator. */

(function () {
  const { EPSILON, isNonterminalSymbol } = window.Grammar;

  /**
   * Bounded leftmost-derivation search for `target` string under grammar g.
   * Returns {found:boolean, steps:[{sentential:[symbols], expanded:nt, production:[symbols], pos:int}], tree:Node}
   */
  function leftmostDerivation(g, target, maxSteps = 4000, maxLen = target.length + 40) {
    const targetSymbols = target.split('');
    let stepsUsed = 0;

    // Node for parse tree: {symbol, children:[Node], isTerminal}
    function search(sentential, nodeMap, depth) {
      stepsUsed++;
      if (stepsUsed > maxSteps) return null;
      if (sentential.length > maxLen) return null;

      // Find leftmost nonterminal
      const idx = sentential.findIndex(s => isNonterminalSymbol(s));
      if (idx === -1) {
        // All terminals: check exact match
        const flat = sentential.filter(s => s !== EPSILON);
        if (flat.join('') === target) {
          return { steps: [], finalSentential: sentential };
        }
        return null;
      }

      // Prune: terminals already fixed at the front must be a prefix of target
      let fixedPrefix = '';
      for (let i = 0; i < idx; i++) fixedPrefix += sentential[i] === EPSILON ? '' : sentential[i];
      if (!target.startsWith(fixedPrefix)) return null;

      const nt = sentential[idx];
      const prods = g.productions[nt] || [];
      for (const alt of prods) {
        const newSentential = [
          ...sentential.slice(0, idx),
          ...alt.filter(s => s !== EPSILON),
          ...sentential.slice(idx + 1),
        ];
        const childNode = {
          symbol: nt,
          children: alt[0] === EPSILON ? [{ symbol: EPSILON, children: [], isTerminal: true }] : alt.map(sym => ({ symbol: sym, children: [], isTerminal: !isNonterminalSymbol(sym) })),
        };
        const result = search(newSentential, nodeMap, depth + 1);
        if (result) {
          result.steps.unshift({ sentential: [...sentential], expanded: nt, position: idx, production: alt });
          result.steps.push; // no-op just to keep shape
          if (!result.tree) result.tree = {};
          result.nodeStack = result.nodeStack || [];
          result.nodeStack.push({ atIndex: idx, node: childNode });
          return result;
        }
      }
      return null;
    }

    const startNode = { symbol: g.start, children: [] };
    const result = search([g.start], null, 0);
    if (!result) return { found: false, steps: [], tree: null, truncated: stepsUsed > maxSteps };

    // Rebuild an actual tree by re-simulating the recorded productions in order (root to leaves,
    // always applied at the recorded leftmost nonterminal occurrence).
    const tree = { symbol: g.start, children: [], isTerminal: false };
    // We track a flat list of "active" leaf nodes mirroring the sentential form.
    let leaves = [tree];
    for (const step of result.steps) {
      // Find the idx-th nonterminal-leaf position matching step.expanded, counting only
      // leaves not yet expanded, in left-to-right order == step.position within sentential form
      // Since sentential form only contains not-yet-expanded leaves in order, position aligns directly.
      const leafIdx = step.position;
      const leaf = leaves[leafIdx];
      leaf.isTerminal = false;
      if (step.production.length === 1 && step.production[0] === EPSILON) {
        leaf.children = [{ symbol: EPSILON, children: [], isTerminal: true }];
      } else {
        leaf.children = step.production.map(sym => ({ symbol: sym, children: [], isTerminal: !isNonterminalSymbol(sym) }));
      }
      leaves = [...leaves.slice(0, leafIdx), ...leaf.children, ...leaves.slice(leafIdx + 1)];
    }

    return { found: true, steps: result.steps, tree, finalSentential: result.finalSentential };
  }

  /**
   * Simulate the standard nondeterministic PDA built from a CFG
   * (single state, stack-based, empty-stack acceptance), following
   * the same production choices used in a found leftmost derivation.
   */
  function pdaTraceFromDerivation(g, target, derivation) {
    if (!derivation.found) return { accepted: false, trace: [] };
    const trace = [];
    let stack = [g.start];
    let inputPos = 0;
    const input = target.split('');

    trace.push({ stack: [...stack], remaining: input.slice(inputPos).join(''), action: 'Inisialisasi: push simbol start ke stack' });

    for (const step of derivation.steps) {
      // Expand: replace step.expanded (top-most matching nonterminal position in stack) using step.production
      const idx = stack.indexOf(step.expanded); // leftmost nonterminal is always on top region
      const prodSymbols = (step.production.length === 1 && step.production[0] === EPSILON) ? [] : step.production;
      stack = [...stack.slice(0, idx), ...prodSymbols, ...stack.slice(idx + 1)];
      trace.push({ stack: [...stack], remaining: input.slice(inputPos).join(''), action: `Ganti ${step.expanded} → ${step.production.join(' ') || 'ε'} (produksi CFG)` });

      // Pop off any terminals now at the front of the stack, matching against input
      while (stack.length && !isNonterminalSymbol(stack[0])) {
        const top = stack[0];
        if (top !== input[inputPos]) {
          trace.push({ stack: [...stack], remaining: input.slice(inputPos).join(''), action: `GAGAL: puncak stack '${top}' tidak cocok dengan input '${input[inputPos] || 'ε'}'` });
          return { accepted: false, trace };
        }
        stack = stack.slice(1);
        inputPos++;
        trace.push({ stack: [...stack], remaining: input.slice(inputPos).join(''), action: `Cocokkan & pop terminal '${top}', maju 1 posisi input` });
      }
    }

    const accepted = stack.length === 0 && inputPos === input.length;
    trace.push({ stack: [...stack], remaining: input.slice(inputPos).join(''), action: accepted ? 'Stack kosong & input habis → DITERIMA' : 'Stack tidak kosong / input tersisa → DITOLAK' });
    return { accepted, trace };
  }

  window.CFGEngine = { leftmostDerivation, pdaTraceFromDerivation };
})();
