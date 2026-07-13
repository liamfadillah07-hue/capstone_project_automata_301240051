/* chomsky.js — converts an arbitrary CFG into Chomsky Normal Form (CNF),
   recording every intermediate transformation step (START, DEL, UNIT, TERM, BIN),
   matching the standard textbook algorithm (Sipser / Hopcroft-Ullman). */

(function () {
  const { EPSILON, cloneGrammar, grammarToText } = window.Grammar;

  function freshName(base, used) {
    let n = 1;
    // Try primes on the base letter first: A -> A1, A2 ...
    let candidate = `${base}${n}`;
    while (used.has(candidate)) { n++; candidate = `${base}${n}`; }
    used.add(candidate);
    return candidate;
  }

  function allUsedNames(g) {
    const s = new Set(g.nonterminals);
    return s;
  }

  // STEP 0: new start symbol so the start symbol never appears on a RHS
  function stepNewStart(g, used) {
    const rhsHasStart = Object.values(g.productions).some(alts =>
      alts.some(alt => alt.includes(g.start)));
    if (!rhsHasStart) return { g, changed: false };
    const g2 = cloneGrammar(g);
    const s0 = freshName('S', used);
    g2.productions[s0] = [[g.start]];
    g2.nonterminals.push(s0);
    g2.order = [s0, ...g2.order];
    g2.start = s0;
    return { g: g2, changed: true };
  }

  // STEP 1: eliminate epsilon (nullable) productions, except possibly S -> eps
  function nullableSet(g) {
    const nullable = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      for (const nt of g.nonterminals) {
        if (nullable.has(nt)) continue;
        for (const alt of g.productions[nt] || []) {
          if (alt.every(sym => sym === EPSILON || nullable.has(sym))) {
            nullable.add(nt); changed = true; break;
          }
        }
      }
    }
    return nullable;
  }

  function stepEliminateEpsilon(g) {
    const nullable = nullableSet(g);
    if (nullable.size === 0) return { g, changed: false };
    const startIsNullable = nullable.has(g.start);
    const g2 = cloneGrammar(g);
    for (const nt of g2.nonterminals) {
      const newAlts = [];
      const seen = new Set();
      for (const alt of g2.productions[nt] || []) {
        const realAlt = alt.filter(s => s !== EPSILON);
        const nullablePositions = realAlt.map((s, i) => nullable.has(s) ? i : -1).filter(i => i >= 0);
        const n = nullablePositions.length;
        for (let mask = 0; mask < (1 << n); mask++) {
          const drop = new Set();
          for (let b = 0; b < n; b++) if (mask & (1 << b)) drop.add(nullablePositions[b]);
          const built = realAlt.filter((_, i) => !drop.has(i));
          if (built.length === 0) continue; // eps re-added below only for the start symbol, if needed
          const key = built.join(' ');
          if (!seen.has(key)) { seen.add(key); newAlts.push(built); }
        }
      }
      g2.productions[nt] = newAlts.length ? newAlts : (g2.productions[nt] || []).filter(a => a.length && a[0] !== EPSILON);
    }
    // Special case: CNF allows S -> ε as the single exception, exactly when ε
    // belongs to the original language (i.e. the start symbol was nullable).
    if (startIsNullable) {
      g2.productions[g.start] = [...g2.productions[g.start], [EPSILON]];
    }
    return { g: g2, changed: true, nullable: [...nullable] };
  }

  // STEP 2: eliminate unit productions A -> B
  function stepEliminateUnit(g) {
    const isUnit = (alt) => alt.length === 1 && /[A-Z]|^<.*>$/.test(alt[0]) && window.Grammar.isNonterminalSymbol(alt[0]);
    let any = false;
    for (const nt of g.nonterminals) if ((g.productions[nt] || []).some(isUnit)) any = true;
    if (!any) return { g, changed: false };

    const g2 = cloneGrammar(g);
    for (const nt of g2.nonterminals) {
      // BFS over unit-reachable nonterminals
      const reachable = new Set([nt]);
      const queue = [nt];
      while (queue.length) {
        const cur = queue.shift();
        for (const alt of g.productions[cur] || []) {
          if (isUnit(alt) && !reachable.has(alt[0])) {
            reachable.add(alt[0]);
            queue.push(alt[0]);
          }
        }
      }
      const newAlts = [];
      const seen = new Set();
      for (const r of reachable) {
        for (const alt of g.productions[r] || []) {
          if (isUnit(alt)) continue; // drop unit productions themselves
          const key = alt.join(' ');
          if (!seen.has(key)) { seen.add(key); newAlts.push(alt); }
        }
      }
      g2.productions[nt] = newAlts;
    }
    return { g: g2, changed: true };
  }

  // STEP 3: TERM — isolate terminals in productions of length >= 2
  function stepIsolateTerminals(g) {
    const used = allUsedNames(g);
    const g2 = cloneGrammar(g);
    const termVar = {}; // terminal -> nonterminal name
    let changed = false;
    for (const nt of g2.nonterminals) {
      g2.productions[nt] = (g2.productions[nt] || []).map(alt => {
        if (alt.length < 2) return alt;
        return alt.map(sym => {
          if (sym === EPSILON) return sym;
          if (window.Grammar.isNonterminalSymbol(sym)) return sym;
          changed = true;
          if (!termVar[sym]) {
            const v = freshName('T', used);
            termVar[sym] = v;
          }
          return termVar[sym];
        });
      });
    }
    for (const [term, v] of Object.entries(termVar)) {
      g2.productions[v] = [[term]];
      g2.nonterminals.push(v);
      g2.order.push(v);
    }
    return { g: g2, changed, termVar };
  }

  // STEP 4: BIN — break productions of length > 2 into binary chains
  function stepBinarize(g) {
    const used = allUsedNames(g);
    const g2 = cloneGrammar(g);
    let changed = false;
    for (const nt of g2.nonterminals) {
      const newAlts = [];
      for (const alt of g2.productions[nt] || []) {
        if (alt.length <= 2) { newAlts.push(alt); continue; }
        changed = true;
        let symbols = [...alt];
        let leftSym = symbols[0];
        let chainHead = nt;
        for (let i = 1; i < symbols.length - 1; i++) {
          const newVar = freshName('X', used);
          if (i === 1) {
            newAlts.push([leftSym, newVar]);
          } else {
            g2.productions[chainHead] = g2.productions[chainHead] || [];
            g2.productions[chainHead].push([leftSym, newVar]);
          }
          g2.nonterminals.push(newVar);
          g2.order.push(newVar);
          chainHead = newVar;
          leftSym = symbols[i];
        }
        g2.productions[chainHead] = g2.productions[chainHead] || [];
        g2.productions[chainHead].push([leftSym, symbols[symbols.length - 1]]);
      }
      g2.productions[nt] = newAlts.length || (g2.productions[nt] || []).every(a => a.length <= 2) ? newAlts.concat((g2.productions[nt] || []).filter(a => a.length <= 2 && !newAlts.includes(a))) : newAlts;
      // simplify: rebuild cleanly
    }
    // Rebuild productions map cleanly to avoid duplication from the loop above
    const clean = {};
    for (const nt of g2.nonterminals) clean[nt] = clean[nt] || [];
    for (const nt of Object.keys(g2.productions)) {
      const seen = new Set();
      clean[nt] = (g2.productions[nt] || []).filter(alt => {
        const key = alt.join(' ');
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
    }
    g2.productions = clean;
    return { g: g2, changed };
  }

  function convertToCNF(grammarText) {
    const steps = [];
    let g = window.Grammar.parseGrammar(grammarText);
    steps.push({ title: 'Grammar Awal', grammar: cloneGrammar(g), note: 'CFG sebagaimana dimasukkan pengguna.' });

    const used = allUsedNames(g);
    const r0 = stepNewStart(g, used);
    g = r0.g;
    if (r0.changed) steps.push({ title: 'START — Simbol Start Baru', grammar: cloneGrammar(g), note: 'Start lama muncul di ruas kanan, sehingga ditambahkan start baru agar start tidak pernah muncul di RHS manapun.' });

    const r1 = stepEliminateEpsilon(g);
    g = r1.g;
    if (r1.changed) steps.push({ title: 'DEL — Eliminasi Produksi ε', grammar: cloneGrammar(g), note: `Nonterminal nullable: {${(r1.nullable||[]).join(', ')}}. Semua kombinasi non-kosong dari kemunculan simbol nullable ditambahkan sebagai alternatif baru, lalu produksi ε dihapus.` });

    let r2 = stepEliminateUnit(g);
    g = r2.g;
    if (r2.changed) steps.push({ title: 'UNIT — Eliminasi Produksi Unit (A → B)', grammar: cloneGrammar(g), note: 'Produksi berbentuk A → B (satu nonterminal) dihilangkan dengan mewariskan produksi B secara transitif ke A.' });

    const r3 = stepIsolateTerminals(g);
    g = r3.g;
    if (r3.changed) steps.push({ title: 'TERM — Isolasi Terminal', grammar: cloneGrammar(g), note: 'Pada produksi dengan panjang ≥ 2, setiap terminal digantikan oleh nonterminal baru yang hanya memproduksi terminal tersebut.' });

    const r4 = stepBinarize(g);
    g = r4.g;
    if (r4.changed) steps.push({ title: 'BIN — Binarisasi', grammar: cloneGrammar(g), note: 'Produksi dengan lebih dari 2 simbol di ruas kanan dipecah menjadi rantai produksi biner menggunakan nonterminal bantu.' });

    steps.push({ title: 'Chomsky Normal Form (Hasil Akhir)', grammar: cloneGrammar(g), note: 'Setiap produksi kini berbentuk A → BC atau A → a (dan S → ε jika bahasa memuat string kosong).' });

    return { steps, cnf: g };
  }

  window.ChomskyEngine = { convertToCNF };
})();
