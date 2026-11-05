/* ALETHI — motore delle regole (porting del motore della mod TTS, ultima versione).
   Gallinello Games · ideazione e game design: Giovanni Colombi
   Coordinate a base 0. Mappa 3x4: r 0..2, c 0..3.
   Crepacci: H(r,c) fra (r,c) e (r,c+1); V(r,c) fra (r,c) e (r+1,c).
   Nodi (i,j) fra (i,j) e (i+1,j+1): i 0..1, j 0..2. */
(function (root) {
'use strict';
const ROWS = 3, COLS = 4;
const COLORS = ['Yellow', 'Purple', 'Red', 'Blue'];
const COLOR_IT = { Yellow: 'Giallo', Purple: 'Viola', Red: 'Rosso', Blue: 'Blu' };
const HOUSES = ['Kholin', 'Sadeas', 'Vamah', 'Sebarial'];
const CARD = { ATK: 0, CON: 3, PON: 5, ATT: 8, STR: 9, RYS: 12, FAB: 13, P4: 16, TRA: 17, COM: 19 };
const CARD_NAME = { ATK: 'Attacco', CON: 'Conquista', PON: 'Pontieri', ATT: 'Attira Abissale', STR: 'Stratolama',
  RYS: 'Ryshadium', FAB: 'Fabrial', P4: 'Ponte Quattro', TRA: 'Tradimento', COM: 'Compra' };
const CARD_DESC = {
  ATK: 'Attacca Parshendi o Abissali nella tua rete. Forza = cristalli + avamposti + Guerriero.',
  CON: 'Metti un avamposto su un altopiano della tua rete. Costo = spazi liberi.',
  PON: 'Posa un ponte per ogni cristallo, a contatto con la tua rete.',
  ATT: 'Sposta un Abissale su un Nodo vicino per ogni cristallo.',
  STR: 'Il tuo Strato Guerriero guadagna +3 forza (o ne schieri uno nuovo).',
  RYS: 'Il Guerriero ha +3 difesa. Vale 1 PV.',
  FAB: 'Dal prossimo turno ogni carta toccata dall\'Animutante riceve +1 cristallo.',
  P4: 'Ponte indistruttibile su qualsiasi crepaccio. Vale 1 PV.',
  TRA: 'In qualsiasi momento: elimina un avamposto nemico.',
  COM: 'Compra una carta del Mercato (costo 4-3-2-1 da sinistra).'
};
const HOUSE_BOARD = {
  Kholin: ['PON', 'ATK', 'CON', 'COM'],
  Sadeas: ['ATK', 'COM', 'PON', 'CON'],
  Vamah: ['ATK', 'CON', 'PON', 'COM'],
  Sebarial: ['PON', 'COM', 'CON', 'ATK']
};
const HOUSE_DESC = { Kholin: '2 cristalli su Attacco', Sadeas: 'token Distruggi ponte', Vamah: '1 cristallo su Compra', Sebarial: '2 cristalli su Pontieri' };

function cardType(idx) {
  if (idx <= 2) return 'ATK'; if (idx <= 4) return 'CON'; if (idx <= 7) return 'PON';
  if (idx === 8) return 'ATT'; if (idx <= 11) return 'STR'; if (idx === 12) return 'RYS';
  if (idx <= 15) return 'FAB'; if (idx === 16) return 'P4'; if (idx <= 18) return 'TRA'; return 'COM';
}
function isBoardCard(t) { return t === 'ATK' || t === 'CON' || t === 'PON' || t === 'ATT' || t === 'COM'; }

function rnd(n) { return Math.floor(Math.random() * n); }
function shuffle(t) { for (let i = t.length - 1; i > 0; i--) { const j = rnd(i + 1); [t[i], t[j]] = [t[j], t[i]]; } return t; }
const key = (x, y) => x + ',' + y;
const unkey = k => k.split(',').map(Number);
const cname = c => COLOR_IT[c] || c;
const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p);

// -------------------------------------------------- geometria
function allCrev() {
  const t = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 1; c++) t.push(['H', r, c]);
  for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) t.push(['V', r, c]);
  return t;
}
function crevEnds(o, r, c) { return o === 'H' ? [r, c, r, c + 1] : [r, c, r + 1, c]; }
function nodeCrevs(i, j) { return [['H', i, j], ['H', i + 1, j], ['V', i, j], ['V', i, j + 1]]; }
function nodeTiles(i, j) { return [[i, j], [i, j + 1], [i + 1, j], [i + 1, j + 1]]; }
function crevNodes(o, r, c) {
  const t = [];
  if (o === 'H') { if (r - 1 >= 0) t.push([r - 1, c]); if (r <= ROWS - 2) t.push([r, c]); }
  else { if (c - 1 >= 0) t.push([r, c - 1]); if (c <= COLS - 2) t.push([r, c]); }
  return t;
}
function orth(r, c) {
  const t = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) t.push([rr, cc]);
  }
  return t;
}
const ck = (o, r, c) => o + ':' + r + ':' + c;

// -------------------------------------------------- stato
let S = null;
function getState() { return S; }
function setState(s) { S = s; }
function clone(s) { return JSON.parse(JSON.stringify(s)); }

function log(msg, col) {
  if (S.quiet) return;
  S.log.push({ m: msg, c: col || null });
  if (S.log.length > 80) S.log.shift();
}
function fx(e) { if (!S.quiet) S.fx.push(e); }

function br(o, r, c) { return S.br[ck(o, r, c)]; }
function outOf(r, c, col) { return S.map[r][c].out[col] || 0; }
function totalOut(r, c) { let n = 0; for (const k in S.map[r][c].out) n += S.map[r][c].out[k]; return n; }
function freeSpaces(r, c) { return S.map[r][c].n - totalOut(r, c); }
function active() { return S.play[S.turn]; }

// seats: [{color, house, ai}]
function newGame(seats) {
  S = { phase: 'SETTLE', order: [], P: {}, log: [], fx: [], quiet: false, sim: false, bonus: [], mode: null, imode: null };
  for (const s of seats) S.order.push(s.color);
  for (const s of seats) {
    const h = s.house;
    const p = { house: h, ai: !!s.ai, board: {}, sel: null, prev: null, wStr: 0, war: null, blades: 0, rysh: false,
      fab: 0, fabPend: 0, p4: false, trad: 0, brk: false, cubes: 0, personal: [] };
    const pos = [[0, 1], [1, 1], [0, 0], [1, 0]];
    HOUSE_BOARD[h].forEach((t, i) => { p.board[key(pos[i][0], pos[i][1])] = { idx: CARD[t], cr: 0 }; });
    const bonus = (t, n) => { for (const k in p.board) if (cardType(p.board[k].idx) === t) p.board[k].cr = n; };
    if (h === 'Kholin') bonus('ATK', 2); else if (h === 'Vamah') bonus('COM', 1);
    else if (h === 'Sebarial') bonus('PON', 2); else if (h === 'Sadeas') p.brk = true;
    S.P[s.color] = p;
  }
  // mappa: Narak + 11 altopiani, almeno un altopiano da 1 per giocatore
  let pool = [];
  for (const [n, q] of [[1, 7], [2, 7], [3, 6], [4, 2], [5, 1]]) for (let i = 0; i < q; i++) pool.push(n);
  shuffle(pool);
  const drawn = pool.splice(0, 11);
  const ones = () => drawn.filter(v => v === 1).length;
  while (ones() < S.order.length) {
    const idx = []; drawn.forEach((v, i) => { if (v !== 1) idx.push(i); });
    const j = idx[rnd(idx.length)];
    const k = pool.indexOf(1); pool.splice(k, 1);
    pool.push(drawn[j]); drawn[j] = 1;
  }
  drawn.push(6); shuffle(drawn);
  S.map = []; let n = 0;
  for (let r = 0; r < ROWS; r++) { S.map[r] = []; for (let c = 0; c < COLS; c++) { S.map[r][c] = { n: drawn[n], parsh: drawn[n], out: {} }; n++; } }
  S.br = {};
  for (const cr of allCrev()) S.br[ck(...cr)] = { n: 0, p4: false };
  const nums = shuffle([1, 2, 3, 4, 5, 6]);
  S.nodes = []; let k = 0;
  for (let i = 0; i < ROWS - 1; i++) { S.nodes[i] = []; for (let j = 0; j < COLS - 1; j++) S.nodes[i][j] = { num: nums[k++], ab: false }; }
  const deck = []; for (let i = 0; i <= 18; i++) deck.push(i);
  S.market = { deck: shuffle(deck), slots: [null, null, null, null] };
  for (let s = 0; s < 4; s++) S.market.slots[s] = S.market.deck.pop();
  S.cumulo = 0; S.hearts = []; S.round = 1; S.lastRound = false;
  S.choice = shuffle(S.order.slice());
  S.play = S.choice.slice().reverse();      // chi sceglie per ultimo gioca per primo
  S.settle = 0; S.turn = 0; S.step = null;
  log('Nuova partita: ' + S.order.length + ' giocatori. ' + cname(S.choice[0]) + ' sceglie per primo il territorio di partenza.');
  return S;
}

// -------------------------------------------------- rete
function comps() {
  const id = []; let nid = 0;
  for (let r = 0; r < ROWS; r++) id[r] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (id[r][c] !== undefined) continue;
    nid++; id[r][c] = nid; const stack = [[r, c]];
    while (stack.length) {
      const [tr, tc] = stack.pop();
      const links = [];
      if (tc < COLS - 1) links.push(['H', tr, tc]);
      if (tc > 0) links.push(['H', tr, tc - 1]);
      if (tr < ROWS - 1) links.push(['V', tr, tc]);
      if (tr > 0) links.push(['V', tr - 1, tc]);
      for (const L of links) {
        const b = br(...L);
        if (b && (b.p4 || b.n > 0)) {
          const [x1, y1, x2, y2] = crevEnds(...L);
          const [or, oc] = (x1 === tr && y1 === tc) ? [x2, y2] : [x1, y1];
          if (id[or][oc] === undefined) { id[or][oc] = nid; stack.push([or, oc]); }
        }
      }
    }
  }
  return id;
}
function presence(col, cid) {
  const set = {}; let any = false;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (outOf(r, c, col) > 0) { set[cid[r][c]] = true; any = true; }
  const w = S.P[col].war;
  if (w) { set[cid[w[0]][w[1]]] = true; any = true; }
  return [set, any];
}
function anyOutposts(cid) {
  const set = {}; let any = false;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (totalOut(r, c) > 0) { set[cid[r][c]] = true; any = true; }
  return [set, any];
}
function forceIn(col, set, cid) {
  let f = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (set[cid[r][c]]) f += outOf(r, c, col);
  const w = S.P[col].war;
  if (w && set[cid[w[0]][w[1]]]) f += S.P[col].wStr;
  return f;
}
function parshForce(r, c) { let f = S.map[r][c].parsh; for (const [a, b] of orth(r, c)) f += S.map[a][b].parsh; return f; }
function abyForce(i, j) { let f = 3; for (const [a, b] of nodeTiles(i, j)) f += freeSpaces(a, b); return f; }
function warriorDefense(col) {
  const p = S.P[col]; if (!p.war) return 0;
  const cid = comps(); const set = { [cid[p.war[0]][p.war[1]]]: true };
  let d = p.wStr + (p.rysh ? 3 : 0);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (set[cid[r][c]]) d += outOf(r, c, col);
  return d;
}
function evalAttack(col, cr, tgtSet, cid, enemy) {
  const own = cr + forceIn(col, tgtSet, cid);
  if (own > enemy) return [own, []];
  const others = [];
  for (const c of S.order) if (c !== col) { const f = forceIn(c, tgtSet, cid); if (f > 0) others.push({ c, f }); }
  others.sort((a, b) => b.f - a.f);
  let tot = own; const lenders = [];
  for (const o of others) { tot += o.f; lenders.push(o.c); if (tot > enemy) return [tot, lenders]; }
  return [own, null];
}

// -------------------------------------------------- punteggio
function scoreOf(col) {
  const p = S.P[col];
  const s = { hearts: 0, war: 0, dom: 0, cubes: p.cubes, rys: p.rysh ? 1 : 0, p4: p.p4 ? 1 : 0 };
  for (const h of S.hearts) if (h === col) s.hearts += 3;
  if (p.war) s.war = 3;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const mine = outOf(r, c, col); let best = 0;
    for (const o of S.order) if (o !== col) best = Math.max(best, outOf(r, c, o));
    if (mine > best) s.dom += S.map[r][c].n;
  }
  s.total = s.hearts + s.war + s.dom + s.cubes + s.rys + s.p4;
  return s;
}

// -------------------------------------------------- insediamento
function settleChooser() { return S.choice[S.settle]; }
function settleTargets() {
  const t = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (S.map[r][c].n === 1 && totalOut(r, c) === 0) t.push([r, c]);
  return t;
}
function doSettle(col, r, c) {
  const t = S.map[r][c];
  t.parsh = 0; t.out[col] = 1;
  S.P[col].war = [r, c]; S.P[col].wStr = 3;
  log(cname(col) + ' (' + S.P[col].house + ') si insedia su un altopiano da 1.', col);
  S.settle++;
  if (S.settle >= S.choice.length) {
    S.phase = 'TURN'; S.turn = 0;
    log('Inizia il gioco. Ordine di turno: ' + S.play.map(cname).join(' → ') + '.');
    startTurn();
  }
}

// -------------------------------------------------- turno
function startTurn() {
  const p = S.P[active()];
  p.fab += p.fabPend; p.fabPend = 0;
  S.step = 'MOVE'; S.mode = null;
  fx({ t: 'turn', col: active() });
}
function selectorTargets(col) { const p = S.P[col]; return Object.keys(p.board).filter(k => k !== p.sel); }
function moveSelector(col, k, isBonus) {
  const p = S.P[col];
  p.prev = p.sel; p.sel = k;
  const [x, y] = unkey(k);
  let gained = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const cd = p.board[key(x + dx, y + dy)];
    if (cd) { cd.cr += 1 + p.fab; gained += 1 + p.fab; }
  }
  log(cname(col) + (isBonus ? ' (Spostamento Bonus)' : '') + ': Animutante su ' + CARD_NAME[cardType(p.board[k].idx)] + ', +' + gained + ' cristalli.', col);
  if (!isBonus) S.step = 'ACT';
}
function endTurn() {
  S.mode = null; S.imode = null;
  S.turn++;
  if (S.turn >= S.play.length) {
    if (S.lastRound) { finish(); return; }
    parshendiPhase();
    S.round++; S.turn = 0;
    log('Round ' + S.round + ': tocca a ' + cname(active()) + '.');
  } else log('Tocca a ' + cname(active()) + '.');
  startTurn();
}

// -------------------------------------------------- Abissali e Guerrieri
function destroyWarrior(col, why) {
  const p = S.P[col];
  p.war = null; p.wStr = 0; p.blades = 0; p.rysh = false;
  p.personal = p.personal.filter(idx => { const t = cardType(idx); return t !== 'STR' && t !== 'RYS'; });
  log('Lo Strato Guerriero di ' + cname(col) + ' è distrutto' + (why || '') + ': Stratolame e Ryshadium scartati.', 'bad');
  fx({ t: 'warDead', col });
}
function abyAttacks(i, j) {
  const f = abyForce(i, j);
  for (const col of S.order) {
    const w = S.P[col].war; if (!w) continue;
    if (nodeTiles(i, j).some(t => t[0] === w[0] && t[1] === w[1])) {
      const d = warriorDefense(col);
      if (f > d) destroyWarrior(col, " dall'Abissale (" + f + ' contro ' + d + ')');
      else log("L'Abissale (" + f + ') non supera la difesa di ' + cname(col) + ' (' + d + ').');
    }
  }
}
function erodeNode(i, j) {
  let n = 0;
  for (const cr of nodeCrevs(i, j)) { const b = br(...cr); if (b && !b.p4 && b.n > 0) { b.n--; n++; fx({ t: 'boom', cr }); } }
  return n;
}
function evocation(attacker) {
  if (S.sim) return;
  const d1 = 1 + rnd(6);
  if (d1 >= S.cumulo) {
    log('Evocazione: dado ' + d1 + ', morti nel Cumulo ' + S.cumulo + ': nessun Abissale.');
    fx({ t: 'dice', d1, cum: S.cumulo });
    return;
  }
  const d2 = 1 + rnd(6);
  fx({ t: 'dice', d1, d2, cum: S.cumulo });
  for (let i = 0; i < ROWS - 1; i++) for (let j = 0; j < COLS - 1; j++) {
    const nd = S.nodes[i][j];
    if (nd.num !== d2) continue;
    if (nd.ab) { log('Evocazione: dado ' + d1 + ' < ' + S.cumulo + ', ma il Nodo ' + d2 + ' è già occupato: nessun effetto.'); return; }
    nd.ab = true;
    S.cumulo = Math.max(0, S.cumulo - 3);
    const e = erodeNode(i, j);
    S.P[attacker].cubes++;
    log('Un ABISSALE emerge nel Nodo ' + d2 + '! Crollano ' + plural(e, 'ponte', 'ponti') + '; ' + cname(attacker) + ' prende un Avvistamento (+1 PV).', 'gold');
    fx({ t: 'aby', i, j });
    abyAttacks(i, j);
    return;
  }
}

// -------------------------------------------------- Fase Parshendi
function parshendiPhase() {
  log('FASE PARSHENDI', 'gold');
  let eroded = 0;
  for (const cr of allCrev()) {
    const b = br(...cr);
    if (!b.p4 && b.n > 0) {
      const [r1, c1, r2, c2] = crevEnds(...cr);
      let hit = S.map[r1][c1].parsh > 0 || S.map[r2][c2].parsh > 0;
      for (const [a, bb] of crevNodes(...cr)) if (S.nodes[a][bb].ab) hit = true;
      if (hit) { b.n--; eroded++; fx({ t: 'boom', cr }); }
    }
  }
  log('Erosione: crollano ' + plural(eroded, 'ponte', 'ponti') + '.');
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = S.map[r][c];
    if (t.parsh <= 0) continue;
    for (const col of S.order) {
      const o = outOf(r, c, col); if (o <= 0) continue;
      const w = S.P[col].war;
      const def = o + ((w && w[0] === r && w[1] === c) ? S.P[col].wStr : 0);
      if (t.parsh > def) { t.out[col] = o - 1; log('Assalto: i Parshendi (' + t.parsh + ') eliminano un avamposto di ' + cname(col) + ' (difesa ' + def + ').', 'bad'); }
    }
  }
  for (let i = 0; i < ROWS - 1; i++) for (let j = 0; j < COLS - 1; j++) if (S.nodes[i][j].ab) abyAttacks(i, j);
  fx({ t: 'parsh' });
}

// -------------------------------------------------- fine partita
function finish() {
  S.phase = 'END'; S.mode = null; S.imode = null;
  let best = -1, winners = [];
  const res = [];
  for (const col of S.order) {
    const s = scoreOf(col); res.push({ col, s });
    if (s.total > best) { best = s.total; winners = [col]; } else if (s.total === best) winners.push(col);
  }
  S.result = { res, winners, best };
  log('La partita finisce. ' + (winners.length > 1 ? 'Pareggio fra ' + winners.map(cname).join(' e ') : 'Vince ' + cname(winners[0])) + ' con ' + best + ' PV.', 'gold');
}

// -------------------------------------------------- azioni
function spendCard(col, k) { S.P[col].board[k].cr = 0; }
function attackParsh(col, k, r, c, lenders) {
  const p = S.P[col];
  const cid = comps(); const set = { [cid[r][c]]: true };
  const hadWar = p.war && set[cid[p.war[0]][p.war[1]]];
  S.map[r][c].parsh--; S.cumulo++;
  spendCard(col, k);
  if (hadWar) p.war = [r, c];
  log(cname(col) + ' uccide un Parshendi' + (lenders.length ? " con l'aiuto di " + lenders.map(cname).join(', ') : '') + (hadWar ? '; il Guerriero avanza sul bersaglio.' : '.'), col);
  fx({ t: 'hit', r, c });
  evocation(col);
  queueBonus(lenders);
}
function attackAby(col, k, i, j, lenders) {
  S.nodes[i][j].ab = false;
  spendCard(col, k);
  S.hearts.push(col);
  log(cname(col) + ' abbatte un ABISSALE' + (lenders.length ? " con l'aiuto di " + lenders.map(cname).join(', ') : '') + ' e prende un Cuorgemma (+3 PV).', 'gold');
  fx({ t: 'kill', i, j });
  if (S.hearts.length >= 3 && !S.lastRound) {
    S.lastRound = true;
    log('Il terzo Abissale è caduto: si completa il round, poi la partita finisce.', 'gold');
  }
  queueBonus(lenders);
}
function queueBonus(lenders) { for (const c of lenders) S.bonus.push(c); nextBonus(); }
function nextBonus() { S.mode = S.bonus.length ? { t: 'BONUS', lender: S.bonus.shift() } : null; }
function conquer(col, k, r, c) {
  const cost = freeSpaces(r, c);
  S.map[r][c].out[col] = outOf(r, c, col) + 1;
  spendCard(col, k);
  log(cname(col) + ' conquista uno spazio (costo ' + cost + ').', col);
  S.mode = null;
}
function buy(col, k, s) {
  const m = S.market; const idx = m.slots[s];
  spendCard(col, k);
  for (let i = s; i >= 1; i--) m.slots[i] = m.slots[i - 1];
  m.slots[0] = m.deck.length ? m.deck.pop() : null;
  const t = cardType(idx); const p = S.P[col];
  log(cname(col) + ' compra ' + CARD_NAME[t] + ' (costo ' + (4 - s) + ').', col);
  if (isBoardCard(t)) { S.mode = { t: 'PLACECARD', idx }; return; }
  p.personal.push(idx);
  S.mode = null;
  if (t === 'STR') {
    p.blades++;
    if (p.war) { p.wStr += 3; log('Lo Strato Guerriero di ' + cname(col) + ' sale a forza ' + p.wStr + '.'); }
    else S.mode = { t: 'WARRIOR' };
  } else if (t === 'RYS') p.rysh = true;
  else if (t === 'FAB') p.fabPend++;
  else if (t === 'P4') { p.p4 = true; S.mode = { t: 'P4' }; }
  else if (t === 'TRA') p.trad++;
}
function placeCard(col, x, y) {
  S.P[col].board[key(x, y)] = { idx: S.mode.idx, cr: 0 };
  S.mode = null;
}
function deployWarrior(col, r, c) {
  const p = S.P[col]; p.war = [r, c]; p.wStr = 3; S.mode = null;
  log('Nuovo Strato Guerriero di ' + cname(col) + ' (forza 3).', col);
}
function placeP4(col, cr) {
  const b = br(...cr); b.p4 = true; b.n = 0; S.mode = null;
  log(cname(col) + ' posa il Ponte Quattro.', col);
}
function placeBridge(col, cr) {
  const b = br(...cr); b.n++; S.mode.left--;
  if (S.mode.left <= 0) { S.mode = null; log(cname(col) + ' ha posato i suoi ponti.', col); }
}

function warriorTargets(col) {
  const cid = comps(); let set = {}, any = false;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (outOf(r, c, col) > 0) { set[cid[r][c]] = true; any = true; }
  if (!any) [set, any] = anyOutposts(cid);
  const t = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!any || set[cid[r][c]]) t.push([r, c]);
  return t;
}
function bridgeTargets(col) {
  const cid = comps(); let [set, any] = presence(col, cid);
  if (!any) [set, any] = anyOutposts(cid);
  return allCrev().filter(cr => {
    if (br(...cr).p4) return false;
    const [r1, c1, r2, c2] = crevEnds(...cr);
    return !any || set[cid[r1][c1]] || set[cid[r2][c2]];
  });
}
function p4Targets() { return allCrev().filter(cr => !br(...cr).p4); }
function conquerTargets(col, cr) {
  const cid = comps(); let [set, any] = presence(col, cid);
  if (!any) [set, any] = anyOutposts(cid);
  const t = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const f = freeSpaces(r, c);
    if (f >= 1 && f <= cr && (!any || set[cid[r][c]] || outOf(r, c, col) > 0)) t.push([r, c, f]);
  }
  return t;
}
function attackTargets(col, cr) {
  const cid = comps(); const [pres] = presence(col, cid);
  const t = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (S.map[r][c].parsh > 0 && pres[cid[r][c]]) {
      const set = { [cid[r][c]]: true }; const enemy = parshForce(r, c);
      const [f, lenders] = evalAttack(col, cr, set, cid, enemy);
      if (lenders) t.push({ kind: 'P', r, c, f, e: enemy, lenders });
    }
  }
  for (let i = 0; i < ROWS - 1; i++) for (let j = 0; j < COLS - 1; j++) {
    if (!S.nodes[i][j].ab) continue;
    const set = {}; let touch = false;
    for (const [a, b] of nodeTiles(i, j)) { set[cid[a][b]] = true; if (pres[cid[a][b]]) touch = true; }
    if (touch) {
      const enemy = abyForce(i, j);
      const [f, lenders] = evalAttack(col, cr, set, cid, enemy);
      if (lenders) t.push({ kind: 'A', i, j, f, e: enemy, lenders });
    }
  }
  return t;
}
function placeTargets(col) {
  const p = S.P[col]; const t = []; const seen = {};
  for (const k in p.board) {
    const [x, y] = unkey(k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const kk = key(x + dx, y + dy);
      if (!p.board[kk] && !seen[kk]) { seen[kk] = true; t.push([x + dx, y + dy]); }
    }
  }
  return t;
}
function nodeNeighbors(i, j) {
  const t = [];
  for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const a = i + di, b = j + dj;
    if (a >= 0 && a <= ROWS - 2 && b >= 0 && b <= COLS - 2 && !S.nodes[a][b].ab) t.push([a, b]);
  }
  return t;
}
function lureMove(col, i, j, a, b) {
  S.nodes[i][j].ab = false; S.nodes[a][b].ab = true;
  const e = erodeNode(a, b);
  log(cname(col) + ' attira un Abissale nel Nodo ' + S.nodes[a][b].num + ': crollano ' + plural(e, 'ponte', 'ponti') + '.', col);
  fx({ t: 'aby', i: a, j: b });
  abyAttacks(a, b);
  S.mode.left--; S.mode.si = a; S.mode.sj = b;
  if (S.mode.left <= 0) S.mode = null;
}
function anyAby() { for (let i = 0; i < ROWS - 1; i++) for (let j = 0; j < COLS - 1; j++) if (S.nodes[i][j].ab) return true; return false; }
function abyList() { const t = []; for (let i = 0; i < ROWS - 1; i++) for (let j = 0; j < COLS - 1; j++) if (S.nodes[i][j].ab) t.push([i, j]); return t; }

// carte giocabili in qualsiasi momento
function traitorTargets(col) {
  const t = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const v of S.order) if (v !== col && outOf(r, c, v) > 0) t.push([r, c, v]);
  return t;
}
function playTraitor(col, r, c, victim) {
  const p = S.P[col];
  S.map[r][c].out[victim] = outOf(r, c, victim) - 1;
  p.trad--;
  const i = p.personal.findIndex(idx => cardType(idx) === 'TRA'); if (i >= 0) p.personal.splice(i, 1);
  log(cname(col) + ' gioca TRADIMENTO: elimina un avamposto di ' + cname(victim) + '.', col);
  S.imode = null;
}
function breakTargets() { return allCrev().filter(cr => { const b = br(...cr); return !b.p4 && b.n > 0; }); }
function breakBridge(col, cr) {
  br(...cr).n--; S.P[col].brk = false;
  log(cname(col) + ' (Sadeas) usa Distruggi ponte: un ponte crolla.', col);
  fx({ t: 'boom', cr });
  S.imode = null;
}

// attivazione di una carta: restituisce un messaggio di errore o null
function canActivate(col, k) {
  const cd = S.P[col].board[k]; if (!cd || cd.cr <= 0) return 'Nessun cristallo su questa carta.';
  const t = cardType(cd.idx);
  if (t === 'ATK' && !attackTargets(col, cd.cr).length) return 'Nessun bersaglio che puoi battere con questa forza.';
  if (t === 'CON' && !conquerTargets(col, cd.cr).length) return 'Nessun altopiano raggiungibile con abbastanza cristalli.';
  if (t === 'COM' && ![0, 1, 2, 3].some(s => S.market.slots[s] != null && (4 - s) <= cd.cr)) return 'Cristalli insufficienti per il Mercato.';
  if (t === 'ATT' && !anyAby()) return 'Non ci sono Abissali sulle Pianure.';
  if (t === 'PON' && !bridgeTargets(col).length) return 'Nessun crepaccio disponibile.';
  return null;
}
function activate(col, k) {
  const cd = S.P[col].board[k]; const t = cardType(cd.idx);
  if (t === 'ATK') S.mode = { t: 'ATTACK', k };
  else if (t === 'CON') S.mode = { t: 'CONQUER', k };
  else if (t === 'COM') S.mode = { t: 'BUY', k };
  else if (t === 'PON') { const n = cd.cr; cd.cr = 0; S.mode = { t: 'BRIDGES', left: n }; log(cname(col) + ' attiva Pontieri: ' + plural(n, 'ponte', 'ponti') + ' da posare.', col); }
  else if (t === 'ATT') { const n = cd.cr; cd.cr = 0; S.mode = { t: 'LURE', left: n }; log(cname(col) + ' attiva Attira Abissale: ' + plural(n, 'spostamento', 'spostamenti') + '.', col); }
}

const E = {
  ROWS, COLS, COLORS, COLOR_IT, HOUSES, CARD, CARD_NAME, CARD_DESC, HOUSE_BOARD, HOUSE_DESC,
  cardType, isBoardCard, key, unkey, cname, shuffle, allCrev, crevEnds, nodeTiles, nodeCrevs, orth, ck,
  getState, setState, clone, br, outOf, totalOut, freeSpaces, active, newGame, comps, presence, forceIn,
  parshForce, abyForce, warriorDefense, scoreOf, settleChooser, settleTargets, doSettle, startTurn,
  selectorTargets, moveSelector, endTurn, finish, attackParsh, attackAby, nextBonus, conquer, buy, placeCard,
  deployWarrior, placeP4, placeBridge, warriorTargets, bridgeTargets, p4Targets, conquerTargets, attackTargets,
  placeTargets, nodeNeighbors, lureMove, anyAby, abyList, traitorTargets, playTraitor, breakTargets, breakBridge,
  canActivate, activate, log
};
root.AlethiEngine = E;
if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
