/* grammar.js
   Shared utilities for parsing context-free grammars written as plain text, e.g.

     S -> a S b | eps
     A -> a A | a

   Rules:
   - One nonterminal's productions per line: "LHS -> alt1 | alt2 | ..."
   - Symbols inside an alternative are separated by whitespace when a symbol
     is more than one character (e.g. "Aa" written as two tokens "A a" is NOT
     required - single uppercase letters are auto-split; multi-char symbols
     should be wrapped in <angle brackets>, e.g. <NP> a <VP>).
   - Epsilon can be written as: eps, epsilon, ε, or e (only when isolated).
   - Terminals: anything that is not an uppercase single letter or a
     <bracketed> nonterminal name is treated as a terminal, character by
     character, unless bracketed.
*/

const EPSILON = 'ε';

function isEpsilonToken(tok) {
  return ['eps', 'epsilon', 'ε', 'Ɛ', '""', "''"].includes(tok.trim());
}

/** Tokenize one alternative (right-hand side) into a list of grammar symbols. */
function tokenizeAlt(alt) {
  const trimmed = alt.trim();
  if (trimmed === '' || isEpsilonToken(trimmed)) return [EPSILON];

  const symbols = [];
  let i = 0;
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '<') {
      const end = trimmed.indexOf('>', i);
      if (end === -1) { symbols.push(ch); i++; continue; }
      symbols.push(trimmed.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    // A single uppercase ASCII letter is a nonterminal token by convention.
    symbols.push(ch);
    i++;
  }
  return symbols;
}

function isNonterminalSymbol(sym) {
  if (sym.startsWith('<') && sym.endsWith('>')) return true;
  return /^[A-Z]$/.test(sym);
}

/**
 * Parse grammar text into a structured grammar object.
 * @returns {{start:string, nonterminals:string[], terminals:string[], productions:Object<string,string[][]>}}
 */
function parseGrammar(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) throw new Error('Grammar kosong. Tuliskan minimal satu aturan produksi.');

  const productions = {};
  const order = [];
  let start = null;

  for (const line of lines) {
    const arrowMatch = line.split(/->|→/);
    if (arrowMatch.length < 2) throw new Error(`Baris tidak valid (tidak ada '->'): "${line}"`);
    const lhsRaw = arrowMatch[0].trim();
    const rhsRaw = arrowMatch.slice(1).join('->');
    const lhsSymbols = tokenizeAlt(lhsRaw);
    if (lhsSymbols.length !== 1 || !isNonterminalSymbol(lhsSymbols[0])) {
      throw new Error(`Ruas kiri harus satu nonterminal (huruf besar tunggal atau <Nama>): "${lhsRaw}"`);
    }
    const lhs = lhsSymbols[0];
    if (start === null) start = lhs;
    if (!productions[lhs]) { productions[lhs] = []; order.push(lhs); }

    const alts = rhsRaw.split('|');
    for (const alt of alts) {
      const symbols = tokenizeAlt(alt);
      productions[lhs].push(symbols);
    }
  }

  const nonterminals = new Set(order);
  const terminals = new Set();
  for (const nt of order) {
    for (const alt of productions[nt]) {
      for (const sym of alt) {
        if (sym === EPSILON) continue;
        if (isNonterminalSymbol(sym)) nonterminals.add(sym);
        else terminals.add(sym);
      }
    }
  }
  // Ensure every nonterminal referenced has at least an (possibly empty) entry
  for (const nt of nonterminals) if (!productions[nt]) productions[nt] = [];

  return {
    start,
    nonterminals: [...nonterminals],
    terminals: [...terminals],
    productions,
    order,
  };
}

/** Render a grammar object back to readable text form. */
function grammarToText(g) {
  const lines = [];
  const nts = g.order && g.order.length ? g.order : Object.keys(g.productions);
  for (const nt of nts) {
    const alts = (g.productions[nt] || []).map(alt => alt.length ? alt.join(' ') : EPSILON);
    if (alts.length === 0) continue;
    lines.push(`${nt} -> ${alts.join(' | ')}`);
  }
  return lines.join('\n');
}

function cloneGrammar(g) {
  const productions = {};
  for (const nt of Object.keys(g.productions)) {
    productions[nt] = g.productions[nt].map(alt => [...alt]);
  }
  return {
    start: g.start,
    nonterminals: [...g.nonterminals],
    terminals: [...g.terminals],
    productions,
    order: [...(g.order || g.nonterminals)],
  };
}

window.Grammar = { EPSILON, parseGrammar, grammarToText, cloneGrammar, isNonterminalSymbol, tokenizeAlt };
