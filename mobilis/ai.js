/* MOBILIS IN MOBILI — personaggi AI: provano le azioni possibili su una copia dello stato
   (fino a due azioni avanti) e scelgono quella che avvicina di più la propria vittoria. */
(function (root) {
'use strict';
const E = root.MimEngine || require('./engine.js');

function withState(s, fn) { const o = E.getState(); E.setState(s); try { return fn(); } finally { E.setState(o); } }
function sim() { const c = E.clone(E.getState()); c.quiet = true; c.fx = []; c.log = []; return c; }

function margin(cond) {
  const S = E.getState();
  if (cond === 'VOYAGE') return S.chest - E.shipsAfloat();
  if (cond === 'REVENGE') return S.wrecks - E.totalBulbs();
  if (cond === 'TECHNOLOGY') return E.totalBulbs() - S.wrecks;
  if (cond === 'REVOLUTION') return E.uprising() - E.shipsAfloat();
  return 0;
}
function charValue(p) {
  const S = E.getState(); const ch = E.CHARS[p.char];
  let v = 0;
  for (const c of ch.conds) { const m = margin(c); v += Math.max(-6, Math.min(3, m)) * 5 + (m > 0 ? 14 : 0); }
  if (E.inHalf(ch.half)) v += 14 + (S.mind.ring === 3 ? -4 : 0);
  else if (S.mind.ring === 0) v += 4;
  return v;
}
function evaluate(pi) {
  const S = E.getState(); const me = S.players[pi];
  if (S.phase === 'END') {
    const r = S.result;
    if (r.winners) return r.winners.includes(pi) ? 10000 : -10000;
    return 0;
  }
  let v = 0;
  const mates = S.players.filter(p => p.team === me.team), foes = S.players.filter(p => p.team !== me.team);
  if (mates.some(E.canWin)) v += 600;
  for (const p of mates) v += charValue(p) * (p === me ? 1 : 0.7);
  for (const p of foes) { if (E.canWin(p)) v -= 700; v -= charValue(p) * 0.6; }
  // memorie e simboli Fate per il Maelstrom
  const t = E.fateType();
  const fate = ps => ps.reduce((a, p) => a + E.fateCount(p.cards, t), 0);
  const cards = ps => ps.reduce((a, p) => a + p.cards.length, 0);
  v += (fate(mates) - fate(foes)) * 5 + (cards(mates) - cards(foes)) * 1.5;
  // rischio Meltdown: chi è di turno perde tutte le memorie
  if (S.mind.ring === 3 && E.player().team === me.team) v -= cards([E.player()]) * 2;
  // un po' di forza nelle camere
  v += Math.min(E.power('NAVIGATE'), 4) * 0.4 + Math.min(E.power('ATTACK'), 5) * 0.2;
  return v;
}

function legal() {
  const a = [];
  if (E.canDeclare()) return [{ t: 'DECLARE' }];
  if (E.reclaimCheck().ok) a.push({ t: 'RECLAIM' });
  for (const [R, s] of E.attackTargets()) a.push({ t: 'ATTACK', route: R, s });
  for (const t of E.navTargets()) a.push({ t: 'NAV', r: t.r, c: t.c });
  for (const c of E.restTargets()) a.push({ t: 'REST', ch: c });
  return a;
}
// scelte durante la risoluzione di una carta
function bestChoice(pi) {
  const P = E.getState().pending; let best = P.options[0], bv = -Infinity;
  for (const o of P.options) {
    const s = sim();
    const v = withState(s, () => { E.choose(o); resolveAll(pi); return evaluate(pi); });
    if (v > bv) { bv = v; best = o; }
  }
  return best;
}
function resolveAll(pi) {
  let g = 0;
  while (E.getState().pending && g++ < 20) { const P = E.getState().pending; E.choose(P.options[0]); }
}
function valueOf(a, pi, depth) {
  const s = sim();
  return withState(s, () => {
    const t0 = s.turn;
    E.act(a);
    let g = 0;
    while (E.getState().pending && g++ < 20) E.choose(bestChoiceFast(pi));
    let v = evaluate(pi);
    const S = E.getState();
    if (depth > 1 && S.phase === 'PLAY' && S.turn === t0 && S.actions > 0) {
      for (const b of legal()) { const w = valueOf(b, pi, depth - 1); if (w > v) v = w; }
    }
    return v;
  });
}
function bestChoiceFast(pi) {
  const P = E.getState().pending; let best = P.options[0], bv = -Infinity;
  for (const o of P.options) {
    const s = sim(); const v = withState(s, () => { E.choose(o); resolveAll(pi); return evaluate(pi); });
    if (v > bv) { bv = v; best = o; }
  }
  return best;
}

// prossima mossa del giocatore di turno: {type:'act', a} o {type:'choose', v}
function decide() {
  const S = E.getState(); const pi = S.turn;
  if (S.pending) return { type: 'choose', v: bestChoice(pi) };
  const acts = legal();
  if (acts.length === 1 && acts[0].t === 'DECLARE') return { type: 'act', a: acts[0] };
  let best = acts[0], bv = -Infinity;
  const depth = acts.length > 30 ? 2 : 3;
  for (const a of acts) {
    const v = valueOf(a, pi, Math.min(depth, S.actions)) + (a.t === 'REST' ? -0.5 : 0) + Math.random() * 0.2;
    if (v > bv) { bv = v; best = a; }
  }
  return { type: 'act', a: best };
}

const AI = { decide, evaluate };
root.MimAI = AI;
if (typeof module !== 'undefined') module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
