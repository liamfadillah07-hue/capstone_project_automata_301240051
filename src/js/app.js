/* app.js — glue code between the UI and the engines. */

(function () {
  // ---------- Tabs ----------
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.panel');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
  function clearError(el) { el.textContent = ''; el.classList.add('hidden'); }

  // ---------- Module 1: FSA ----------
  const fsaDefaultText = `states: q0,q1,q2
alphabet: 0,1
start: q0
final: q2
transitions:
q0,0,q0
q0,1,q1
q1,0,q2
q1,1,q0
q2,0,q2
q2,1,q2`;
  const fsaDefText = document.getElementById('fsa-def');
  fsaDefText.value = fsaDefaultText;
  const fsaErr = document.getElementById('fsa-error');
  let currentFSA = null;

  document.getElementById('fsa-load').addEventListener('click', () => {
    clearError(fsaErr);
    try {
      currentFSA = window.FSAEngine.parseFSA(fsaDefText.value);
      document.getElementById('fsa-type-badge').textContent = currentFSA.isNFA ? 'NFA (nondeterministik / punya ε)' : 'DFA (deterministik)';
      window.SVGViz.renderAutomaton(document.getElementById('fsa-diagram'), currentFSA);
      document.getElementById('fsa-table').innerHTML = buildTransitionTable(currentFSA);
    } catch (e) { showError(fsaErr, e.message); }
  });
  document.getElementById('fsa-load').click();

  function buildTransitionTable(fsa) {
    const symbols = fsa.alphabet.length ? fsa.alphabet : [...new Set(Object.keys(fsa.transitions).map(k => k.split('|')[1]))];
    let html = '<table><thead><tr><th>State</th>' + symbols.map(s => `<th>${s}</th>`).join('') + '</tr></thead><tbody>';
    for (const st of fsa.states) {
      html += `<tr><td>${st === fsa.start ? '→' : ''}${fsa.finals.includes(st) ? '*' : ''}${st}</td>`;
      for (const sym of symbols) {
        const targets = fsa.transitions[`${st}|${sym}`] || [];
        html += `<td>${targets.join(', ') || '-'}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  document.getElementById('fsa-simulate').addEventListener('click', () => {
    clearError(fsaErr);
    if (!currentFSA) return showError(fsaErr, 'Muat definisi FSA terlebih dahulu.');
    const input = document.getElementById('fsa-input').value.trim();
    try {
      const { accepted, trace } = window.FSAEngine.simulate(currentFSA, input);
      const resultEl = document.getElementById('fsa-result');
      resultEl.className = accepted ? 'result accepted' : 'result rejected';
      resultEl.textContent = accepted ? `DITERIMA — "${input}" dikenali oleh mesin.` : `DITOLAK — "${input}" tidak dikenali oleh mesin.`;
      const traceEl = document.getElementById('fsa-trace');
      traceEl.innerHTML = trace.map(t =>
        `<div class="trace-row"><span class="trace-step">${t.step}</span>` +
        `${t.symbol !== null ? `<span class="trace-sym">baca '${t.symbol}'</span>` : '<span class="trace-sym">mulai</span>'}` +
        `<span class="trace-set">{ ${t.stateSet.join(', ') || '∅'} }</span></div>`
      ).join('');
      const last = trace[trace.length - 1];
      window.SVGViz.renderAutomaton(document.getElementById('fsa-diagram'), currentFSA, new Set(last.stateSet));
    } catch (e) { showError(fsaErr, e.message); }
  });

  document.getElementById('fsa-convert').addEventListener('click', () => {
    clearError(fsaErr);
    if (!currentFSA) return showError(fsaErr, 'Muat definisi FSA terlebih dahulu.');
    try {
      const dfa = window.FSAEngine.nfaToDfa(currentFSA);
      const mapText = Object.entries(dfa.subsetMap).map(([k, v]) => `${k || '∅'} = { ${[...v].join(', ') || '∅'} }`).join('\n');
      document.getElementById('fsa-nfa2dfa-map').textContent = mapText;
      document.getElementById('fsa-nfa2dfa-table').innerHTML = buildTransitionTable(dfa);
      window.SVGViz.renderAutomaton(document.getElementById('fsa-nfa2dfa-diagram'), dfa);
      document.getElementById('fsa-nfa2dfa-panel').classList.remove('hidden');
    } catch (e) { showError(fsaErr, e.message); }
  });

  // ---- Moore / Mealy ----
  const moore = document.getElementById('moore-def');
  moore.value = `states: q0/0,q1/1,q2/0
start: q0
transitions:
q0,0,q0
q0,1,q1
q1,0,q2
q1,1,q0
q2,0,q2
q2,1,q1`;
  document.getElementById('moore-run').addEventListener('click', () => {
    const err = document.getElementById('moore-error'); clearError(err);
    try {
      const m = window.FSAEngine.parseMoore(moore.value);
      const input = document.getElementById('moore-input').value.trim();
      const { output, trace, error } = window.FSAEngine.runMoore(m, input);
      if (error) return showError(err, error);
      document.getElementById('moore-output').textContent = `Output: ${output}`;
      document.getElementById('moore-trace').innerHTML = trace.map((t, i) =>
        `<div class="trace-row"><span class="trace-step">${i}</span><span class="trace-set">state ${t.state}${t.symbolConsumed ? `, baca '${t.symbolConsumed}'` : ''} → output '${t.output}'</span></div>`
      ).join('');
    } catch (e) { showError(err, e.message); }
  });

  const mealy = document.getElementById('mealy-def');
  mealy.value = `states: q0,q1
start: q0
transitions:
q0,0,q0,A
q0,1,q1,B
q1,0,q0,A
q1,1,q1,B`;
  document.getElementById('mealy-run').addEventListener('click', () => {
    const err = document.getElementById('mealy-error'); clearError(err);
    try {
      const m = window.FSAEngine.parseMealy(mealy.value);
      const input = document.getElementById('mealy-input').value.trim();
      const { output, trace, error } = window.FSAEngine.runMealy(m, input);
      if (error) return showError(err, error);
      document.getElementById('mealy-output').textContent = `Output: ${output}`;
      document.getElementById('mealy-trace').innerHTML = trace.slice(1).map((t, i) =>
        `<div class="trace-row"><span class="trace-step">${i + 1}</span><span class="trace-set">${t.state} --${t.symbolConsumed}/${t.out}--> ${t.to}</span></div>`
      ).join('');
    } catch (e) { showError(err, e.message); }
  });

  // ---------- Module 2: Regex ----------
  const regexErr = document.getElementById('regex-error');
  let lastNFA = null;
  document.getElementById('regex-build').addEventListener('click', () => {
    clearError(regexErr);
    const re = document.getElementById('regex-input').value.trim();
    try {
      lastNFA = window.RegexEngine.regexToNFA(re);
      window.SVGViz.renderAutomaton(document.getElementById('regex-nfa-diagram'), lastNFA);
      const grammar = window.RegexEngine.toRightLinearGrammar(lastNFA);
      document.getElementById('regex-grammar').textContent = grammar.text;
    } catch (e) { showError(regexErr, e.message); }
  });

  document.getElementById('regex-test').addEventListener('click', () => {
    clearError(regexErr);
    if (!lastNFA) return showError(regexErr, 'Bangun NFA dari regex terlebih dahulu.');
    const input = document.getElementById('regex-test-input').value;
    const { accepted, trace } = window.FSAEngine.simulate(lastNFA, input);
    const resultEl = document.getElementById('regex-result');
    resultEl.className = accepted ? 'result accepted' : 'result rejected';
    resultEl.textContent = accepted ? `COCOK — "${input}" sesuai dengan pola.` : `TIDAK COCOK — "${input}" tidak sesuai dengan pola.`;
    const last = trace[trace.length - 1];
    window.SVGViz.renderAutomaton(document.getElementById('regex-nfa-diagram'), lastNFA, new Set(last.stateSet));
  });

  document.getElementById('regex-to-dfa').addEventListener('click', () => {
    clearError(regexErr);
    if (!lastNFA) return showError(regexErr, 'Bangun NFA dari regex terlebih dahulu.');
    const dfa = window.FSAEngine.nfaToDfa(lastNFA);
    window.SVGViz.renderAutomaton(document.getElementById('regex-dfa-diagram'), dfa);
    document.getElementById('regex-dfa-panel').classList.remove('hidden');
  });

  // ---------- Module 3: CFG / PDA ----------
  const cfgErr = document.getElementById('cfg-error');
  const cfgDef = document.getElementById('cfg-def');
  cfgDef.value = `S -> a S b | ab`;

  document.getElementById('cfg-derive').addEventListener('click', () => {
    clearError(cfgErr);
    const target = document.getElementById('cfg-input').value;
    try {
      const g = window.Grammar.parseGrammar(cfgDef.value);
      const derivation = window.CFGEngine.leftmostDerivation(g, target);
      const resultEl = document.getElementById('cfg-result');
      if (!derivation.found) {
        resultEl.className = 'result rejected';
        resultEl.textContent = `DITOLAK — tidak ditemukan derivasi untuk "${target}" (dalam batas pencarian).`;
        document.getElementById('cfg-derivation-steps').innerHTML = '';
        document.getElementById('cfg-tree').innerHTML = '';
        document.getElementById('cfg-pda-trace').innerHTML = '';
        return;
      }
      resultEl.className = 'result accepted';
      resultEl.textContent = `DITERIMA — string "${target}" dapat diturunkan dari grammar (derivasi leftmost).`;

      // Derivation steps as sentential forms
      let sentential = [g.start];
      const stepLines = [sentential.join(' ')];
      for (const step of derivation.steps) {
        const idx = step.position;
        const prod = (step.production.length === 1 && step.production[0] === 'ε') ? [] : step.production;
        sentential = [...sentential.slice(0, idx), ...prod, ...sentential.slice(idx + 1)];
        stepLines.push(`${sentential.join(' ') || 'ε'}   (${step.expanded} → ${step.production.join(' ') || 'ε'})`);
      }
      document.getElementById('cfg-derivation-steps').innerHTML = stepLines.map((l, i) => `<div class="trace-row"><span class="trace-step">${i}</span><span class="trace-set mono">${l}</span></div>`).join('');

      window.SVGViz.renderParseTree(document.getElementById('cfg-tree'), derivation.tree);

      const pda = window.CFGEngine.pdaTraceFromDerivation(g, target, derivation);
      document.getElementById('cfg-pda-trace').innerHTML = '<table><thead><tr><th>#</th><th>Stack (atas → bawah)</th><th>Sisa Input</th><th>Aksi</th></tr></thead><tbody>' +
        pda.trace.map((t, i) => `<tr><td>${i}</td><td class="mono">${t.stack.join(' ') || 'ε'}</td><td class="mono">${t.remaining || 'ε'}</td><td>${t.action}</td></tr>`).join('') +
        '</tbody></table>';
    } catch (e) { showError(cfgErr, e.message); }
  });

  // ---------- Module 4: Chomsky Hierarchy & CNF ----------
  const cnfErr = document.getElementById('cnf-error');
  const cnfDef = document.getElementById('cnf-def');
  cnfDef.value = `S -> A B | eps
A -> a A | a
B -> b B | b`;

  document.getElementById('cnf-convert').addEventListener('click', () => {
    clearError(cnfErr);
    try {
      const { steps } = window.ChomskyEngine.convertToCNF(cnfDef.value);
      const container = document.getElementById('cnf-steps');
      container.innerHTML = steps.map((s, i) => `
        <div class="cnf-step">
          <div class="cnf-step-title">${i + 1}. ${s.title}</div>
          <div class="cnf-step-note">${s.note || ''}</div>
          <pre class="mono grammar-box">${window.Grammar.grammarToText(s.grammar)}</pre>
        </div>`).join('');
    } catch (e) { showError(cnfErr, e.message); }
  });

  document.getElementById('cnf-example').addEventListener('click', () => {
    cnfDef.value = `S -> A B\nA -> a A | eps\nB -> b B | b`;
  });

})();
