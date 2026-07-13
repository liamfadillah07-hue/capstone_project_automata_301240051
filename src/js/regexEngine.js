/* regexEngine.js — recursive-descent regex parser + Thompson's construction
   producing an NFA compatible with fsa.js's FSAEngine, plus derivation of an
   equivalent right-linear (Type-3) regular grammar from the resulting NFA. */

(function () {
  // Grammar of supported regex: literal chars, '(' ')' grouping, '|' union,
  // '*' Kleene star, '+' one-or-more, '?' optional, implicit concatenation.
  function tokenize(re) {
    return re.replace(/\s+/g, '').split('');
  }

  function parseRegex(re) {
    const tokens = tokenize(re);
    let pos = 0;
    function peek() { return tokens[pos]; }
    function eat(ch) { if (tokens[pos] !== ch) throw new Error(`Ekspektasi '${ch}' pada posisi ${pos}`); pos++; }

    function parseUnion() {
      let node = parseConcat();
      while (peek() === '|') { eat('|'); const right = parseConcat(); node = { type: 'union', left: node, right }; }
      return node;
    }
    function parseConcat() {
      let node = null;
      while (pos < tokens.length && peek() !== '|' && peek() !== ')') {
        const next = parseUnary();
        node = node ? { type: 'concat', left: node, right: next } : next;
      }
      if (!node) node = { type: 'epsilon' };
      return node;
    }
    function parseUnary() {
      let node = parseAtom();
      while (pos < tokens.length && (peek() === '*' || peek() === '+' || peek() === '?')) {
        const op = tokens[pos]; pos++;
        node = { type: op === '*' ? 'star' : op === '+' ? 'plus' : 'optional', child: node };
      }
      return node;
    }
    function parseAtom() {
      const ch = peek();
      if (ch === '(') { eat('('); const node = parseUnion(); eat(')'); return node; }
      if (ch === undefined) throw new Error('Ekspresi tidak lengkap.');
      pos++;
      return { type: 'literal', value: ch };
    }

    const tree = parseUnion();
    if (pos !== tokens.length) throw new Error(`Karakter tak terduga pada posisi ${pos}: '${tokens[pos]}'`);
    return tree;
  }

  // Thompson construction: build fragment {start, end, transitions:{key:[targets]}, states:Set}
  function thompson(node, counter) {
    function newState() { return `q${counter.n++}`; }

    switch (node.type) {
      case 'epsilon': {
        const s = newState(), e = newState();
        return { start: s, end: e, states: new Set([s, e]), trans: { [`${s}|ε`]: [e] } };
      }
      case 'literal': {
        const s = newState(), e = newState();
        return { start: s, end: e, states: new Set([s, e]), trans: { [`${s}|${node.value}`]: [e] }, symbols: new Set([node.value]) };
      }
      case 'concat': {
        const a = thompson(node.left, counter);
        const b = thompson(node.right, counter);
        const trans = mergeTrans(a.trans, b.trans);
        trans[`${a.end}|ε`] = (trans[`${a.end}|ε`] || []).concat(b.start);
        return { start: a.start, end: b.end, states: unionSet(a.states, b.states), trans, symbols: unionSet(a.symbols, b.symbols) };
      }
      case 'union': {
        const a = thompson(node.left, counter);
        const b = thompson(node.right, counter);
        const s = newState(), e = newState();
        const trans = mergeTrans(a.trans, b.trans);
        addTrans(trans, s, 'ε', a.start);
        addTrans(trans, s, 'ε', b.start);
        addTrans(trans, a.end, 'ε', e);
        addTrans(trans, b.end, 'ε', e);
        return { start: s, end: e, states: unionSet(unionSet(a.states, b.states), new Set([s, e])), trans, symbols: unionSet(a.symbols, b.symbols) };
      }
      case 'star': {
        const a = thompson(node.child, counter);
        const s = newState(), e = newState();
        const trans = { ...a.trans };
        addTrans(trans, s, 'ε', a.start);
        addTrans(trans, s, 'ε', e);
        addTrans(trans, a.end, 'ε', a.start);
        addTrans(trans, a.end, 'ε', e);
        return { start: s, end: e, states: unionSet(a.states, new Set([s, e])), trans, symbols: a.symbols };
      }
      case 'plus': {
        const a = thompson(node.child, counter);
        const s = newState(), e = newState();
        const trans = { ...a.trans };
        addTrans(trans, s, 'ε', a.start);
        addTrans(trans, a.end, 'ε', a.start);
        addTrans(trans, a.end, 'ε', e);
        return { start: s, end: e, states: unionSet(a.states, new Set([s, e])), trans, symbols: a.symbols };
      }
      case 'optional': {
        const a = thompson(node.child, counter);
        const s = newState(), e = newState();
        const trans = { ...a.trans };
        addTrans(trans, s, 'ε', a.start);
        addTrans(trans, s, 'ε', e);
        addTrans(trans, a.end, 'ε', e);
        return { start: s, end: e, states: unionSet(a.states, new Set([s, e])), trans, symbols: a.symbols };
      }
      default:
        throw new Error('Node regex tidak dikenal: ' + node.type);
    }
  }

  function addTrans(trans, from, sym, to) { const k = `${from}|${sym}`; trans[k] = (trans[k] || []).concat(to); }
  function mergeTrans(a, b) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = (out[k] || []).concat(v);
    return out;
  }
  function unionSet(a = new Set(), b = new Set()) { return new Set([...a, ...b]); }

  /** Build an NFA object compatible with FSAEngine given a regex string. */
  function regexToNFA(re) {
    const tree = parseRegex(re);
    const counter = { n: 0 };
    const frag = thompson(tree, counter);
    return {
      states: [...frag.states],
      alphabet: [...(frag.symbols || new Set())],
      start: frag.start,
      finals: [frag.end],
      transitions: frag.trans,
      isNFA: true,
      tree,
    };
  }

  /** Derive an equivalent right-linear (Type-3) regular grammar from an NFA/DFA. */
  function toRightLinearGrammar(fsa) {
    // One nonterminal per state, named by state id (uppercase-ified for readability).
    const nameOf = {};
    fsa.states.forEach((s, i) => { nameOf[s] = `<${s}>`; });
    const lines = [];
    for (const state of fsa.states) {
      const alts = [];
      for (const [key, targets] of Object.entries(fsa.transitions)) {
        const [from, sym] = key.split('|');
        if (from !== state) continue;
        for (const t of targets) {
          alts.push(sym === 'ε' ? `${nameOf[t]}` : `${sym} ${nameOf[t]}`);
        }
      }
      if (fsa.finals.includes(state)) alts.push('ε');
      if (alts.length) lines.push(`${nameOf[state]} -> ${alts.join(' | ')}`);
    }
    return { text: lines.join('\n'), startSymbol: nameOf[fsa.start] };
  }

  window.RegexEngine = { parseRegex, regexToNFA, toRightLinearGrammar };
})();
