/* fsa.js — parses a simple line-based FSA definition, runs DFA/NFA simulation
   with a full trace, converts NFA -> DFA via subset construction, and supports
   basic Moore / Mealy machine evaluation. */

(function () {
  const EPS = 'e'; // epsilon token in transition definitions (e or eps or ε)

  function normEps(sym) {
    const s = sym.trim();
    return (s === 'e' || s === 'eps' || s === 'ε') ? 'ε' : s;
  }

  /**
   * Text format:
   *   states: q0,q1,q2
   *   alphabet: 0,1
   *   start: q0
   *   final: q2
   *   transitions:
   *   q0,0,q0
   *   q0,1,q1
   *   q1,0,q2|q0     (multiple targets separated by | => NFA)
   *   q1,1,q0
   *   q2,0,q2
   *   q2,1,q2
   */
  function parseFSA(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length && !l.startsWith('#'));
    let states = [], alphabet = [], start = null, finals = [];
    const transitions = {}; // key `${state}|${symbol}` -> [targets]
    let inTransitions = false;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('states:')) { states = line.slice(7).split(',').map(s => s.trim()).filter(Boolean); continue; }
      if (lower.startsWith('alphabet:')) { alphabet = line.slice(9).split(',').map(s => s.trim()).filter(Boolean); continue; }
      if (lower.startsWith('start:')) { start = line.slice(6).trim(); continue; }
      if (lower.startsWith('final:') || lower.startsWith('finals:')) {
        finals = line.split(':')[1].split(',').map(s => s.trim()).filter(Boolean); continue;
      }
      if (lower.startsWith('transitions:')) { inTransitions = true; continue; }
      if (inTransitions) {
        const parts = line.split(',').map(s => s.trim());
        if (parts.length < 3) throw new Error(`Baris transisi tidak valid: "${line}"`);
        const [from, sym, ...rest] = parts;
        const targetField = rest.join(',');
        const targets = targetField.split('|').map(s => s.trim()).filter(Boolean);
        const key = `${from}|${normEps(sym)}`;
        transitions[key] = (transitions[key] || []).concat(targets);
      }
    }

    if (!start) throw new Error('Definisi "start:" tidak ditemukan.');
    if (states.length === 0) throw new Error('Definisi "states:" tidak ditemukan / kosong.');

    const isNFA = Object.entries(transitions).some(([k, v]) => v.length > 1 || k.endsWith('|ε'));
    return { states, alphabet, start, finals, transitions, isNFA };
  }

  function epsilonClosure(fsa, stateSet) {
    const stack = [...stateSet];
    const closure = new Set(stateSet);
    while (stack.length) {
      const s = stack.pop();
      const targets = fsa.transitions[`${s}|ε`] || [];
      for (const t of targets) if (!closure.has(t)) { closure.add(t); stack.push(t); }
    }
    return closure;
  }

  function move(fsa, stateSet, symbol) {
    const result = new Set();
    for (const s of stateSet) {
      const targets = fsa.transitions[`${s}|${symbol}`] || [];
      for (const t of targets) result.add(t);
    }
    return result;
  }

  /** Simulate string on DFA/NFA; returns {accepted, trace:[{step, from:Set, symbol, to:Set}]} */
  function simulate(fsa, input) {
    let current = epsilonClosure(fsa, new Set([fsa.start]));
    const trace = [{ step: 0, symbol: null, stateSet: [...current] }];
    for (let i = 0; i < input.length; i++) {
      const sym = input[i];
      const moved = move(fsa, current, sym);
      current = epsilonClosure(fsa, moved);
      trace.push({ step: i + 1, symbol: sym, stateSet: [...current] });
      if (current.size === 0) break;
    }
    const accepted = [...current].some(s => fsa.finals.includes(s));
    return { accepted, trace };
  }

  /** Subset construction: NFA -> DFA. Returns a new fsa-like object plus a mapping table. */
  function nfaToDfa(fsa) {
    const alphabet = fsa.alphabet.filter(a => normEps(a) !== 'ε');
    const startSet = epsilonClosure(fsa, new Set([fsa.start]));
    const startKey = [...startSet].sort().join(',') || '∅';

    const dfaStates = {}; // key -> Set
    dfaStates[startKey] = startSet;
    const dfaTransitions = {};
    const queue = [startKey];
    const seen = new Set([startKey]);

    while (queue.length) {
      const key = queue.shift();
      const set = dfaStates[key];
      for (const sym of alphabet) {
        const moved = move(fsa, set, sym);
        const closure = epsilonClosure(fsa, moved);
        const newKey = closure.size ? [...closure].sort().join(',') : '∅';
        dfaTransitions[`${key}|${sym}`] = [newKey];
        if (!seen.has(newKey)) {
          seen.add(newKey);
          dfaStates[newKey] = closure;
          queue.push(newKey);
        }
      }
    }

    const dfaFinals = Object.keys(dfaStates).filter(k => [...dfaStates[k]].some(s => fsa.finals.includes(s)));

    return {
      states: Object.keys(dfaStates),
      alphabet,
      start: startKey,
      finals: dfaFinals,
      transitions: dfaTransitions,
      isNFA: false,
      subsetMap: dfaStates,
    };
  }

  // ---- Moore / Mealy ----
  // Moore text format:
  //   states: q0/0, q1/1, q2/0     (state/output)
  //   start: q0
  //   transitions:
  //   q0,0,q1
  //   q0,1,q0
  function parseMoore(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length && !l.startsWith('#'));
    let stateDefs = [], start = null;
    const transitions = {};
    let inTrans = false;
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('states:')) { stateDefs = line.slice(7).split(',').map(s => s.trim()); continue; }
      if (lower.startsWith('start:')) { start = line.slice(6).trim(); continue; }
      if (lower.startsWith('transitions:')) { inTrans = true; continue; }
      if (inTrans) {
        const [from, sym, to] = line.split(',').map(s => s.trim());
        transitions[`${from}|${sym}`] = to;
      }
    }
    const outputs = {};
    const states = stateDefs.map(sd => {
      const [name, out] = sd.split('/').map(s => s.trim());
      outputs[name] = out;
      return name;
    });
    return { states, start, transitions, outputs };
  }

  function runMoore(machine, input) {
    let current = machine.start;
    let output = machine.outputs[current] || '';
    const trace = [{ state: current, output: machine.outputs[current] }];
    for (const sym of input) {
      const next = machine.transitions[`${current}|${sym}`];
      if (!next) return { output, trace, error: `Tidak ada transisi dari ${current} dengan simbol '${sym}'` };
      current = next;
      output += machine.outputs[current] || '';
      trace.push({ state: current, symbolConsumed: sym, output: machine.outputs[current] });
    }
    return { output, trace };
  }

  // Mealy text format:
  //   states: q0,q1
  //   start: q0
  //   transitions:
  //   q0,0,q0,A
  //   q0,1,q1,B
  function parseMealy(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length && !l.startsWith('#'));
    let states = [], start = null;
    const transitions = {}; // key state|symbol -> {next, out}
    let inTrans = false;
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('states:')) { states = line.slice(7).split(',').map(s => s.trim()); continue; }
      if (lower.startsWith('start:')) { start = line.slice(6).trim(); continue; }
      if (lower.startsWith('transitions:')) { inTrans = true; continue; }
      if (inTrans) {
        const [from, sym, to, out] = line.split(',').map(s => s.trim());
        transitions[`${from}|${sym}`] = { next: to, out };
      }
    }
    return { states, start, transitions };
  }

  function runMealy(machine, input) {
    let current = machine.start;
    let output = '';
    const trace = [{ state: current }];
    for (const sym of input) {
      const t = machine.transitions[`${current}|${sym}`];
      if (!t) return { output, trace, error: `Tidak ada transisi dari ${current} dengan simbol '${sym}'` };
      output += t.out;
      trace.push({ state: current, symbolConsumed: sym, to: t.next, out: t.out });
      current = t.next;
    }
    return { output, trace };
  }

  window.FSAEngine = { parseFSA, simulate, nfaToDfa, epsilonClosure, move, parseMoore, runMoore, parseMealy, runMealy };
})();
