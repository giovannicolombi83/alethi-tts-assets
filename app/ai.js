/* ALETHI — avversari AI. Sceglie le mosse simulando ogni alternativa su una copia
   dello stato e valutando il risultato (punti, cristalli, rete, minacce). */
(function (root) {
'use strict';
const E = root.AlethiEngine || require('./engine.js');
const { ROWS, COLS } = E;

function withState(s, fn) { const old = E.getState(); E.setState(s); try { return fn(); } finally { E.setState(old); } }
function simClone() { const c = E.clone(E.getState()); c.quiet = true; c.sim = true; c.fx = []; c.log = []; return c; }

// ------------------------------------------------ valutazione
function evaluate(col) {
  const S = E.getState(); const p = S.P[col];
  const sc = {}; for (const c of S.order) sc[c] = E.scoreOf(c).total;
  let maxOther = 0; for (const c of S.order) if (c !== col) maxOther = Math.max(maxOther, sc[c]);
  if (S.phase === 'END') return (sc[col] - maxOther) * 100 + sc[col];
  const late = S.lastRound ? 0.1 : 1;
  let v = sc[col] * 10 - maxOther * 6;
  // cristalli e plancia
  let cr = 0; for (const k in p.board) { const x = p.board[k].cr; cr += Math.min(x, 4) + Math.max(0, Math.min(x, 7) - 4) * 0.4; }
  v += cr * 0.7 * late;
  v += (Object.keys(p.board).length - 4) * 2.4 * late;
  v += (p.fab + p.fabPend) * 3 * late + p.trad * 2.5 + (p.brk ? 1.5 : 0);
  // Guerriero
  if (p.war) v += p.wStr * 0.8 + (p.rysh ? 1 : 0);
  // rete
  const cid = E.comps(); const [pres] = E.presence(col, cid);
  let bestAtk0 = 0; for (const k in p.board) if (E.cardType(p.board[k].idx) === 'ATK') bestAtk0 = Math.max(bestAtk0, p.board[k].cr);
  let outs = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const o = E.outOf(r, c, col); outs += o;
    if (pres[cid[r][c]]) {
      v += 0.5 * late + E.freeSpaces(r, c) * 0.25 * late - S.map[r][c].parsh * 0.6 * late;
      if (S.map[r][c].parsh > 0 && bestAtk0 > 0 && bestAtk0 + E.forceIn(col, { [cid[r][c]]: true }, cid) > E.parshForce(r, c)) v += 2.5 * late;
    }
    // minaccia dei Parshendi sui miei avamposti
    if (o > 0 && S.map[r][c].parsh > 0) {
      const w = p.war; const def = o + ((w && w[0] === r && w[1] === c) ? p.wStr : 0);
      if (S.map[r][c].parsh > def) v -= 6 * late;
    }
  }
  v += outs * 1.2;
  // accumulare cristalli su Attacco fino alla forza che serve per abbattere un Abissale
  if (!S.lastRound) {
    let need = 0;
    for (const [i, j] of E.abyList()) {
      let near = 0;
      if (p.war && E.nodeTiles(i, j).some(t => t[0] === p.war[0] && t[1] === p.war[1])) near += p.wStr;
      for (const [a, b] of E.nodeTiles(i, j)) near += E.outOf(a, b, col);
      const n = E.abyForce(i, j) + 1 - near;
      if (need === 0 || n < need) need = n;
    }
    if (need > 0) v += Math.min(bestAtk0, need) * 0.9;
  }
  // Abissali: opportunità e minacce
  let bestAtk = 0; for (const k in p.board) if (E.cardType(p.board[k].idx) === 'ATK') bestAtk = Math.max(bestAtk, p.board[k].cr);
  for (const [i, j] of E.abyList()) {
    const tiles = E.nodeTiles(i, j);
    const set = {}; let touch = false;
    for (const [a, b] of tiles) { set[cid[a][b]] = true; if (pres[cid[a][b]]) touch = true; }
    if (touch) {
      const f = E.forceIn(col, set, cid) + bestAtk;
      v += f > E.abyForce(i, j) ? 7 * late : 1.5 * late;
    }
    if (p.war && tiles.some(t => t[0] === p.war[0] && t[1] === p.war[1]) && E.abyForce(i, j) > E.warriorDefense(col)) v -= 9;
  }
  // cristalli degli avversari (il prestito dà loro uno Spostamento Bonus)
  for (const c of S.order) if (c !== col) { let o = 0; const q = S.P[c]; for (const k in q.board) o += Math.min(q.board[k].cr, 5); v -= o * 0.25 * late; }
  return v;
}

// ------------------------------------------------ mosse atomiche dentro i modi
function bestOf(cands, apply, col, allowStop) {
  let best = null, bestV = -Infinity;
  if (allowStop) { bestV = evaluate(col) + 0.05; best = { stop: true }; }
  for (const c of cands) {
    const s = simClone();
    const v = withState(s, () => { apply(c); return evaluate(col); });
    if (v > bestV) { bestV = v; best = { c }; }
  }
  return best;
}

// azione per i modi "di seguito" (dopo un'attivazione): restituisce {fn, desc}
function modeAction(col) {
  const S = E.getState(); const m = S.mode;
  if (!m) return null;
  if (m.t === 'BONUS') {
    // chi chiede il prestito sceglie dove va l'Animutante di chi presta: il meno utile possibile
    const L = S.P[m.lender];
    let best = null, bestV = Infinity;
    for (const k of E.selectorTargets(m.lender)) {
      const s = simClone();
      const v = withState(s, () => { E.moveSelector(m.lender, k, true); return evaluate(m.lender); });
      if (v < bestV) { bestV = v; best = k; }
    }
    return { fn: () => { E.moveSelector(m.lender, best, true); E.nextBonus(); }, hl: { board: m.lender, k: best } };
  }
  if (m.t === 'PLACECARD') {
    const b = bestOf(E.placeTargets(col), pt => E.placeCard(col, pt[0], pt[1]), col, false);
    // a parità preferisci la posizione con più vicini
    let pt = b.c, nb = -1;
    for (const q of E.placeTargets(col)) {
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => S.P[col].board[E.key(q[0] + d[0], q[1] + d[1])]).length;
      if (n > nb) { nb = n; pt = q; }
    }
    return { fn: () => E.placeCard(col, pt[0], pt[1]) };
  }
  if (m.t === 'WARRIOR') {
    const b = bestOf(E.warriorTargets(col), t => E.deployWarrior(col, t[0], t[1]), col, false);
    return { fn: () => E.deployWarrior(col, b.c[0], b.c[1]), hl: { tile: b.c } };
  }
  if (m.t === 'P4') {
    const b = bestOf(E.p4Targets(), cr => E.placeP4(col, cr), col, false);
    return { fn: () => E.placeP4(col, b.c), hl: { crev: b.c } };
  }
  if (m.t === 'BRIDGES') {
    const t = E.bridgeTargets(col);
    if (!t.length) return { fn: () => { S.mode = null; } };
    const b = bestOf(t, cr => E.placeBridge(col, cr), col, false);
    return { fn: () => E.placeBridge(col, b.c), hl: { crev: b.c } };
  }
  if (m.t === 'LURE') {
    const cands = [];
    const from = (m.si !== undefined) ? [[m.si, m.sj]].filter(([i, j]) => S.nodes[i][j].ab) : E.abyList();
    for (const [i, j] of (from.length ? from : E.abyList())) for (const nb of E.nodeNeighbors(i, j)) cands.push([i, j, nb[0], nb[1]]);
    const b = bestOf(cands, c => E.lureMove(col, c[0], c[1], c[2], c[3]), col, true);
    if (!b || b.stop) return { fn: () => { S.mode = null; } };
    return { fn: () => E.lureMove(col, b.c[0], b.c[1], b.c[2], b.c[3]), hl: { node: [b.c[2], b.c[3]] } };
  }
  if (m.t === 'ATTACK' || m.t === 'CONQUER' || m.t === 'BUY') return { fn: () => { S.mode = null; } };
  return null;
}

function resolveModes(col) {
  let guard = 0;
  while (E.getState().mode && E.getState().phase !== 'END' && guard++ < 40) {
    const a = modeAction(col); if (!a) break; a.fn();
  }
  if (E.getState().mode) E.getState().mode = null;
}

// ------------------------------------------------ azioni complete (attiva + bersaglio)
function macroActions(col) {
  const S = E.getState(); const p = S.P[col]; const acts = [];
  for (const k of Object.keys(p.board)) {
    const cd = p.board[k]; if (cd.cr <= 0 || E.canActivate(col, k)) continue;
    const t = E.cardType(cd.idx);
    if (t === 'ATK') for (const tg of E.attackTargets(col, cd.cr)) acts.push({ k, t, tg,
      run: () => { E.activate(col, k); tg.kind === 'P' ? E.attackParsh(col, k, tg.r, tg.c, tg.lenders) : E.attackAby(col, k, tg.i, tg.j, tg.lenders); } });
    else if (t === 'CON') for (const tg of E.conquerTargets(col, cd.cr)) acts.push({ k, t, tg,
      run: () => { E.activate(col, k); E.conquer(col, k, tg[0], tg[1]); } });
    else if (t === 'COM') for (let s = 0; s < 4; s++) { if (S.market.slots[s] != null && 4 - s <= cd.cr) acts.push({ k, t, tg: s, run: () => { E.activate(col, k); E.buy(col, k, s); } }); }
    else acts.push({ k, t, run: () => E.activate(col, k) });
  }
  return acts;
}
function macroBonus(a, s) {
  // uccidere Parshendi fa avanzare la partita: Cumulo, Abissali e Avvistamenti
  if (a.t === 'ATK' && a.tg.kind === 'P') return 8 + Math.max(0, Math.min(5, s.cumulo - 1)) / 6 * 6;
  return 0;
}
// valore della migliore azione (con un passo di anticipo se depth > 1)
function bestMacro(col, depth) {
  depth = depth || 1;
  let best = null; let bestV = evaluate(col) + 0.3;
  for (const a of macroActions(col)) {
    const s = simClone();
    const v = withState(s, () => {
      a.run(); resolveModes(col);
      let val = evaluate(col) + macroBonus(a, s);
      if (depth > 1 && s.phase !== 'END') {
        const b = bestMacro(col, 1);
        if (b && b.v + macroBonus(a, s) > val) val = b.v + macroBonus(a, s);
      }
      return val;
    });
    if (v > bestV) { bestV = v; best = a; }
  }
  if (best) best.v = bestV;
  return best;
}
function planTurnValue(col) {
  let guard = 0;
  while (guard++ < 12 && E.getState().phase !== 'END') {
    const a = bestMacro(col, 1); if (!a) break; a.run(); resolveModes(col);
  }
  return evaluate(col);
}

// ------------------------------------------------ carte "in qualsiasi momento"
function bestAnytime(col) {
  const S = E.getState(); const p = S.P[col];
  const base = evaluate(col); let best = null, bestV = base + 4;
  if (p.trad > 0) for (const t of E.traitorTargets(col)) {
    const s = simClone(); const v = withState(s, () => { E.playTraitor(col, t[0], t[1], t[2]); return evaluate(col); });
    if (v > bestV) { bestV = v; best = { fn: () => E.playTraitor(col, t[0], t[1], t[2]), hl: { tile: [t[0], t[1]] } }; }
  }
  if (p.brk) for (const cr of E.breakTargets()) {
    const s = simClone(); const v = withState(s, () => { E.breakBridge(col, cr); return evaluate(col); });
    if (v > bestV + 2) { bestV = v; best = { fn: () => E.breakBridge(col, cr), hl: { crev: cr } }; }
  }
  return best;
}

// ------------------------------------------------ decisione principale
function settleScore(r, c) {
  const S = E.getState(); let v = 0;
  for (const [a, b] of E.orth(r, c)) v += S.map[a][b].n * 0.8 - S.map[a][b].parsh * 0.3 + 1;
  // vicinanza ai Nodi (Abissali)
  for (let i = 0; i < ROWS - 1; i++) for (let j = 0; j < COLS - 1; j++) if (E.nodeTiles(i, j).some(t => t[0] === r && t[1] === c)) v += 0.7;
  return v + Math.random() * 0.5;
}

// restituisce la prossima azione dell'AI per il giocatore di turno: {fn, hl?, end?}
function decide() {
  const S = E.getState();
  if (S.phase === 'SETTLE') {
    let best = null, bv = -Infinity;
    for (const [r, c] of E.settleTargets()) { const v = settleScore(r, c); if (v > bv) { bv = v; best = [r, c]; } }
    const col = E.settleChooser();
    return { fn: () => E.doSettle(col, best[0], best[1]), hl: { tile: best } };
  }
  if (S.phase !== 'TURN') return null;
  const col = E.active();
  if (S.mode) return modeAction(col);
  if (S.step === 'MOVE') {
    let best = null, bv = -Infinity;
    for (const k of E.selectorTargets(col)) {
      const s = simClone();
      const v = withState(s, () => { E.moveSelector(col, k); return planTurnValue(col); });
      if (v > bv) { bv = v; best = k; }
    }
    return { fn: () => E.moveSelector(col, best), hl: { board: col, k: best } };
  }
  const any = bestAnytime(col);
  if (any) return any;
  const a = bestMacro(col, 2);
  if (!a) return { fn: () => E.endTurn(), end: true };
  // esegue in due tempi: attivazione, poi il bersaglio (gestito qui per mostrare l'evidenziazione)
  let hl = { board: col, k: a.k };
  if (a.t === 'ATK') hl = a.tg.kind === 'P' ? { tile: [a.tg.r, a.tg.c] } : { node: [a.tg.i, a.tg.j] };
  else if (a.t === 'CON') hl = { tile: [a.tg[0], a.tg[1]] };
  else if (a.t === 'COM') hl = { slot: a.tg };
  return { fn: a.run, hl, card: a.k };
}

const AI = { decide, evaluate, modeAction };
root.AlethiAI = AI;
if (typeof module !== 'undefined') module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
