/* MOBILIS IN MOBILI — motore delle regole (regolamento del 30 ottobre 2026).
   Gallinello Games · Giovanni Colombi.
   Un solo Nautilus condiviso: i giocatori si contendono la direzione della mente di Nemo. */
(function (root) {
'use strict';
const CARDS = root.MIM_CARDS || require('./cards.js');
const CH = ['INNOVATE', 'ATTACK', 'REVOLUTION', 'EXPLORE', 'NAVIGATE'];   // ordine orario
const CH_IT = { INNOVATE: 'Innovate', ATTACK: 'Attack', REVOLUTION: 'Revolution', EXPLORE: 'Explore', NAVIGATE: 'Navigate' };
const QUADS = ['NE', 'SE', 'SW', 'NW'];
const OPP = { NE: 'SW', SW: 'NE', NW: 'SE', SE: 'NW' };
const HALF = { N: ['NW', 'NE'], S: ['SW', 'SE'], E: ['NE', 'SE'], W: ['NW', 'SW'] };
const CHARS = {
  ARONNAX: { name: 'Dr. Aronnax', half: 'W', conds: ['TECHNOLOGY', 'VOYAGE'] },
  CONSEIL: { name: 'Conseil', half: 'S', conds: ['TECHNOLOGY', 'REVOLUTION'] },
  NED: { name: 'Ned Land', half: 'E', conds: ['REVENGE', 'REVOLUTION'] },
  EGO: { name: "Nemo's Ego", half: 'N', conds: ['REVENGE', 'VOYAGE'] }
};
const COND_IT = { VOYAGE: { it: 'Voyage: Tesori > Navi', en: 'Voyage: Treasures > Warships' }, REVENGE: { it: 'Revenge: Relitti > Lampadine', en: 'Revenge: Wrecks > Light Bulbs' }, TECHNOLOGY: { it: 'Technology: Lampadine > Relitti', en: 'Technology: Light Bulbs > Wrecks' }, REVOLUTION: { it: 'Revolution: Uprising > Navi', en: 'Revolution: Uprising > Warships' } };
const B = (it, en) => ({ it, en });
const RT = r => r === 'N' ? B('nord', 'north') : B('sud', 'south');
const MAX_RING = 3;

let S = null;
const getState = () => S, setState = s => { S = s; }, clone = s => JSON.parse(JSON.stringify(s));
const rnd = n => Math.floor(Math.random() * n);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function log(m, c) { if (S.quiet) return; S.log.push({ m, c: c || null }); if (S.log.length > 100) S.log.shift(); }
function fx(e) { if (!S.quiet) S.fx.push(e); }
const card = id => CARDS[id];

// ------------------------------------------------ preparazione
// opts: { mode: 'multi'|'team'|'solo', players: [{char, ai, name}] }
function newGame(opts) {
  const solo = opts.mode === 'solo';
  const np = solo ? 1 : opts.players.length;
  const per = np <= 2 ? 7 : np === 3 ? 8 : 9;
  const deck = shuffle(CARDS.map(c => c.id));
  S = { mode: opts.mode, phase: 'PLAY', log: [], fx: [], quiet: false, queue: [], pending: null,
    players: (solo ? [{ char: null, ai: false, name: 'Nemo' }] : opts.players).map((p, i) => ({ ...p, idx: i, cards: [],
      team: opts.mode === 'team' ? (i % 2) : i })),
    turn: 0, actions: 3, round: 1, reclaimedThisTurn: false,
    ch: {}, supply: { sailor: 14 - 10, bulb: 14, treasure: 13, uprising: 6, warship: solo ? 4 : 6 },
    chest: 1, wrecks: 0,
    routes: { N: solo ? [1, 1, 1, 1] : [1, 1, 1, 0], S: solo ? [1, 1, 1, 1] : [1, 1, 1, 0] },
    rows: [], naut: { r: 1, c: 0 }, nemesis: solo ? { r: 1, c: -1 } : null, nemLoot: [],
    mind: { ring: 0, q: null }, result: null };
  for (const c of CH) S.ch[c] = { s: 2, b: 0, u: 0 };
  for (let r = 0; r < 3; r++) S.rows.push({ cards: deck.splice(0, 5), stack: deck.splice(0, per) });
  S.discard = deck;          // carte non usate in questa partita
  log(solo ? B('Partita in solitario: Nemo contro la sua Nemesis.', 'Solo game: Nemo against his Nemesis.') : B('Nuova partita: ' + S.players.map(p => CHARS[p.char].name).join(', ') + '.', 'New game: ' + S.players.map(p => CHARS[p.char].name).join(', ') + '.'));
  return S;
}

// ------------------------------------------------ utilità di stato
const power = c => S.ch[c].s > 0 ? S.ch[c].s + S.ch[c].b + (c === 'ATTACK' ? S.ch[c].u : 0) : 0;
const shipsAfloat = () => S.routes.N.reduce((a, b) => a + b, 0) + S.routes.S.reduce((a, b) => a + b, 0);
const totalBulbs = () => CH.reduce((a, c) => a + S.ch[c].b, 0);
const totalSailors = () => CH.reduce((a, c) => a + S.ch[c].s, 0);
const uprising = () => S.ch.ATTACK.u;
const shield = () => S.wrecks;
function rowLen(r) { return S.rows[r].cards.length; }
function maelstromAt(r) { return S.rows[r].stack.length === 0 ? rowLen(r) : -1; }
function cardAt(r, c) { const row = S.rows[r]; return (c >= 0 && c < row.cards.length) ? row.cards[c] : null; }
function isMaelstrom(r, c) { return maelstromAt(r) === c; }
function validPos(r, c) {
  if (r < 0 || r > 2 || c < 0) return false;
  if (c < rowLen(r)) return S.mode === 'solo' || cardAt(r, c) !== null;
  return isMaelstrom(r, c);
}
// navi diagonalmente adiacenti a una posizione: [route, spazio]
function shipsNear(r, c) {
  const t = [];
  const routes = r === 0 ? ['N'] : r === 1 ? ['N', 'S'] : ['S'];
  for (const R of routes) for (const s of [c - 1, c]) if (s >= 0 && s <= 3 && S.routes[R][s]) t.push([R, s]);
  return t;
}
function requirement(r, c) { const id = cardAt(r, c); return id === null ? 0 : card(id).req + shipsNear(r, c).length; }
const player = () => S.players[S.turn];
function condMet(cond) {
  if (cond === 'VOYAGE') return S.chest > shipsAfloat();
  if (cond === 'REVENGE') return S.wrecks > totalBulbs();
  if (cond === 'TECHNOLOGY') return totalBulbs() > S.wrecks;
  if (cond === 'REVOLUTION') return uprising() > shipsAfloat();
  return false;
}
function inHalf(h) { return S.mind.q !== null && HALF[h].includes(S.mind.q); }
function canWin(p) { if (!p.char) return false; const ch = CHARS[p.char]; return ch.conds.every(condMet) && inHalf(ch.half); }

// ------------------------------------------------ mancala
function redistribute(c) {
  let n = S.ch[c].s; S.ch[c].s = 0;
  let i = CH.indexOf(c); const path = [];
  while (n > 0) { i = (i + 1) % 5; S.ch[CH[i]].s++; n--; path.push(CH[i]); }
  fx({ t: 'sow', from: c, path });
  return path;
}

// ------------------------------------------------ equilibrio
function imbalance(dir, chosen) {
  // dir: quadrante 'NE' o metà 'E'; chosen: quadrante scelto se il token è al centro con una metà
  const m = S.mind;
  if (dir.length === 2) {
    if (m.ring === 0) { m.ring = 1; m.q = dir; }
    else if (m.q === dir) m.ring++;
    else if (m.q === OPP[dir]) { m.ring--; if (m.ring === 0) m.q = null; }
    else m.q = dir;
  } else {
    const h = HALF[dir];
    if (m.ring === 0) { m.ring = 1; m.q = chosen && h.includes(chosen) ? chosen : h[0]; }
    else if (h.includes(m.q)) m.ring++;
    else { m.ring--; if (m.ring === 0) m.q = null; }
  }
  fx({ t: 'mind' });
  if (m.ring > MAX_RING) return meltdown();
  return false;
}
function meltdown() {
  S.mind = { ring: 0, q: null };
  fx({ t: 'meltdown' });
  if (S.mode === 'solo') {
    log(B('MELTDOWN! Nemo perde la ragione: la partita è persa.', 'MELTDOWN! Nemo loses his mind: the game is lost.'), 'bad');
    S.phase = 'END'; S.result = { solo: true, win: false, why: 'Meltdown' }; S.queue = []; S.pending = null;
    return true;
  }
  const p = player();
  log(B('MELTDOWN! ' + who(p) + ' scarta tutte le sue memorie (' + p.cards.length + ').', 'MELTDOWN! ' + who(p) + ' discards all their memories (' + p.cards.length + ').'), 'bad');
  S.discard.push(...p.cards); p.cards = [];
  // il secondo squilibrio della stessa carta non si applica
  S.queue = S.queue.filter(q => !(q.t === 'fx' && q.fx.startsWith('I:') && q.card === S.curCard));
  return true;
}
function who(p) { return p.char ? CHARS[p.char].name : 'Nemo'; }

// ------------------------------------------------ navi
function summon(route) {
  const R = S.routes[route];
  if (S.supply.warship <= 0 || R.every(x => x)) { log(B('Allerta al massimo: nessuna nave da evocare sulla rotta ' + RT(route).it + '.', 'Maximum alert: no Warship can be summoned on the ' + RT(route).en + ' route.')); return; }
  // spinge le navi verso sinistra per liberare lo spazio più a destra
  let e = 3; while (R[e]) e--;
  for (let i = e; i < 3; i++) R[i] = R[i + 1];
  R[3] = 1; S.supply.warship--;
  log(B('Una nave da guerra compare sulla rotta ' + RT(route).it + '.', 'A Warship appears on the ' + RT(route).en + ' route.'), 'bad');
  fx({ t: 'ship', route });
}
function sink(route, s) {
  S.routes[route][s] = 0; S.wrecks++;
  fx({ t: 'sink', route, s });
  log(B('Nave affondata sulla rotta ' + RT(route).it + ': il relitto va nell\'Abyssal Graveyard.', 'Warship sunk on the ' + RT(route).en + ' route: the Wreck goes to the Abyssal Graveyard.'), 'gold');
  return imbalance('NE');     // ogni vita tolta spinge la mente verso la Vendetta
}

// ------------------------------------------------ azioni disponibili
function navTargets() {
  const P = power('NAVIGATE'); if (P <= 0) return [];
  const start = S.naut; const seen = { [start.r + ',' + start.c]: 0 }; const prev = {};
  const q = [[start.r, start.c]]; const out = [];
  while (q.length) {
    const [r, c] = q.shift(); const d = seen[r + ',' + c];
    if (d >= P) continue;
    if (isMaelstrom(r, c) && !(r === start.r && c === start.c)) continue;  // il Maelstrom inghiotte
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const rr = r + dr, cc = c + dc, k = rr + ',' + cc;
      if (k in seen || !validPos(rr, cc)) continue;
      if (S.nemesis && S.nemesis.r === rr && S.nemesis.c === cc) continue;
      seen[k] = d + 1; prev[k] = r + ',' + c; q.push([rr, cc]);
      out.push({ r: rr, c: cc, d: d + 1 });
    }
  }
  for (const o of out) { o.prev = prev[o.r + ',' + o.c].split(',').map(Number); }
  return out;
}
function reclaimCheck() {
  const { r, c } = S.naut; const id = cardAt(r, c);
  if (id === null || id === undefined) return { ok: false, why: B('Il Nautilus non è su una carta.', 'The Nautilus is not on a card.') };
  const cd = card(id); const req = requirement(r, c); const pw = power(cd.type);
  if (pw < req) return { ok: false, why: B('Serve ' + CH_IT[cd.type] + ' ' + req + ', hai ' + pw + '.', 'You need ' + CH_IT[cd.type] + ' ' + req + ', you have ' + pw + '.'), req, pw, id };
  const need = { T: 0, W: 0, S: 0 };
  for (const f of cd.fx) if (f[0] === '-') need[f[1]]++;
  if (need.T > S.chest) return { ok: false, why: B('Serve un tesoro nello Scrigno.', 'You need a Treasure in the Chest.'), req, pw, id };
  if (need.W > S.wrecks) return { ok: false, why: B('Serve un relitto nell\'Abyssal Graveyard.', 'You need a Wreck in the Abyssal Graveyard.'), req, pw, id };
  if (need.S > totalSailors()) return { ok: false, why: B('Non hai marinai da perdere.', 'You have no Sailors to lose.'), req, pw, id };
  return { ok: true, req, pw, id };
}
function attackTargets() {
  const pw = power('ATTACK'); const sh = Math.max(1, shield() + 1);
  if (pw < sh) return [];
  return shipsNear(S.naut.r, S.naut.c);
}
function restTargets() { return CH.filter(c => S.ch[c].s > 0); }
function canDeclare() { return S.mode !== 'solo' && !S.pending && S.players.some(p => p.team === player().team && canWin(p)); }

// ------------------------------------------------ esecuzione
function act(a) {
  // a: {t:'REST',ch} | {t:'NAV',r,c} | {t:'RECLAIM'} | {t:'ATTACK',route,s} | {t:'DECLARE'}
  if (S.phase !== 'PLAY' || S.pending) return false;
  const p = player();
  if (a.t === 'REST') {
    if (!S.ch[a.ch].s) return false;
    redistribute(a.ch); log(B(who(p) + ' riposa: ridistribuisce ' + CH_IT[a.ch] + '.', who(p) + ' rests: redistributes ' + CH_IT[a.ch] + '.'), p.idx);
  } else if (a.t === 'NAV') {
    const t = navTargets().find(o => o.r === a.r && o.c === a.c); if (!t) return false;
    const from = { ...S.naut };
    redistribute('NAVIGATE');
    S.naut = { r: a.r, c: a.c };
    if (S.nemesis) S.nemesis = { r: t.prev[0], c: t.prev[1] };
    log(B(who(p) + ' naviga di ' + t.d + (t.d === 1 ? ' passo.' : ' passi.'), who(p) + ' navigates ' + t.d + (t.d === 1 ? ' step.' : ' steps.')), p.idx);
    fx({ t: 'nav', from, to: S.naut });
    if (isMaelstrom(a.r, a.c)) { maelstromEnd(); return true; }
  } else if (a.t === 'RECLAIM') {
    const k = reclaimCheck(); if (!k.ok) return false;
    const cd = card(k.id); const { r, c } = S.naut;
    redistribute(cd.type);
    S.rows[r].cards[c] = null; p.cards.push(k.id); S.curCard = k.id; S.reclaimedThisTurn = true;
    log(B(who(p) + ' reclama «' + cd.title + '» (' + CH_IT[cd.type] + ' ' + k.pw + ' su ' + k.req + ').', who(p) + ' reclaims “' + cd.title + '” (' + CH_IT[cd.type] + ' ' + k.pw + ' vs ' + k.req + ').'), p.idx);
    fx({ t: 'reclaim', id: k.id });
    for (const f of cd.fx) S.queue.push({ t: 'fx', fx: f, card: k.id, row: r });
    if (cd.ship) S.queue.push({ t: 'ship', row: r, card: k.id });
    if (S.mode === 'solo') S.queue.push({ t: 'nemReclaim' });
    else S.queue.push({ t: 'refill', r, c });
  } else if (a.t === 'ATTACK') {
    if (!attackTargets().some(([R, s]) => R === a.route && s === a.s)) return false;
    const pw = power('ATTACK');
    redistribute('ATTACK');
    log(B(who(p) + ' attacca una nave (forza ' + pw + ' contro scudo ' + shield() + ').', who(p) + ' attacks a Warship (power ' + pw + ' vs shield ' + shield() + ').'), p.idx);
    S.curCard = null;
    sink(a.route, a.s);
    if (S.phase !== 'PLAY') return true;
    if (S.mode === 'solo') S.queue.push({ t: 'nemAttack' });
  } else if (a.t === 'DECLARE') {
    if (!canDeclare()) return false;
    S.phase = 'END'; S.result = { declare: true, winners: S.players.filter(q => q.team === p.team).map(q => q.idx), by: p.idx };
    log(B(who(p) + ' dichiara la vittoria!', who(p) + ' declares victory!'), 'gold');
    return true;
  } else return false;
  S.actions--;
  run();
  return true;
}

// elabora la coda degli effetti finché serve una scelta
function run() {
  while (S.phase === 'PLAY' && !S.pending && S.queue.length) {
    const q = S.queue[0];
    if (q.t === 'fx') {
      const f = q.fx;
      if (f === '+T') { if (S.supply.treasure > 0) { S.supply.treasure--; S.chest++; log(B('Un tesoro entra nello Scrigno.', 'A Treasure enters the Chest.')); } }
      else if (f === '-T') { S.chest = Math.max(0, S.chest - 1); S.supply.treasure++; log(B('Si consuma un tesoro dello Scrigno.', 'A Treasure from the Chest is spent.')); }
      else if (f === '-W') { S.wrecks = Math.max(0, S.wrecks - 1); S.supply.warship++; log(B('Si consuma un relitto dell\'Abyssal Graveyard.', 'A Wreck from the Abyssal Graveyard is consumed.')); }
      else if (f === '+U') { if (S.supply.uprising > 0) { S.supply.uprising--; S.ch.ATTACK.u++; log(B('Un Uprising si unisce alla camera Attack.', 'An Uprising joins the Attack chamber.')); } }
      else if (f === '+B') { if (S.supply.bulb > 0) { S.pending = { kind: 'BULB', options: CH.slice() }; return; } }
      else if (f === '+S') { if (S.supply.sailor > 0) { S.pending = { kind: 'ADD_SAILOR', options: CH.slice() }; return; } }
      else if (f === '-S') { const o = CH.filter(c => S.ch[c].s > 0); if (o.length) { S.pending = { kind: 'LOSE_SAILOR', options: o }; return; } }
      else if (f.startsWith('I:')) {
        const d = f.slice(2);
        if (d.length === 1 && S.mind.ring === 0) { S.pending = { kind: 'QUADRANT', options: HALF[d], dir: d }; return; }
        S.queue.shift(); imbalance(d); continue;
      }
      S.queue.shift();
    } else if (q.t === 'ship') {
      if (q.row === 0) summon('N'); else if (q.row === 2) summon('S');
      else {
        const opts = ['N', 'S'].filter(R => !S.routes[R].every(x => x));
        if (S.supply.warship > 0 && opts.length > 1) { S.pending = { kind: 'ROUTE', options: opts }; return; }
        summon(opts[0] || 'N');
      }
      S.queue.shift();
    } else if (q.t === 'refill') { S.queue.shift(); refill(q.r, q.c); }
    else if (q.t === 'nemReclaim') { S.queue.shift(); nemesisReclaim(); }
    else if (q.t === 'nemAttack') {
      S.queue.shift();
      const n = S.nemesis; if (!n || n.c < 0) continue;
      const t = shipsNear(n.r, n.c);
      if (t.length > 1) { S.pending = { kind: 'NEM_SINK', options: t }; return; }
      if (t.length === 1) { log(B('La Nemesis affonda una nave.', 'The Nemesis sinks a Warship.'), 'bad'); sink(t[0][0], t[0][1]); }
    }
  }
  if (S.phase === 'PLAY' && !S.pending && !S.queue.length && S.actions <= 0) endTurn();
}
function choose(v) {
  const P = S.pending; if (!P) return false;
  const q = S.queue[0];
  S.pending = null;
  if (P.kind === 'BULB') { S.supply.bulb--; S.ch[v].b++; log(B('Lampadina nella camera ' + CH_IT[v] + '.', 'Light Bulb in the ' + CH_IT[v] + ' chamber.')); S.queue.shift(); }
  else if (P.kind === 'ADD_SAILOR') { S.supply.sailor--; S.ch[v].s++; log(B('Un marinaio si aggiunge alla camera ' + CH_IT[v] + '.', 'A Sailor joins the ' + CH_IT[v] + ' chamber.')); S.queue.shift(); }
  else if (P.kind === 'LOSE_SAILOR') { S.ch[v].s--; S.supply.sailor++; log(B('Un marinaio lascia la camera ' + CH_IT[v] + '.', 'A Sailor leaves the ' + CH_IT[v] + ' chamber.')); S.queue.shift(); }
  else if (P.kind === 'QUADRANT') { S.queue.shift(); imbalance(P.dir, v); }
  else if (P.kind === 'ROUTE') { summon(v); S.queue.shift(); }
  else if (P.kind === 'NEM_SINK') { log(B('La Nemesis affonda una nave.', 'The Nemesis sinks a Warship.'), 'bad'); sink(v[0], v[1]); }
  run();
  return true;
}

// ------------------------------------------------ fiumi di memorie
function refill(r, c) {
  const row = S.rows[r];
  row.cards.splice(c, 1);
  if (row.stack.length) row.cards.push(row.stack.pop());
  if (!row.stack.length) fx({ t: 'maelstrom', r });
  // il Nautilus resta nello spazio: la carta successiva gli scivola sotto
  if (S.naut.r === r && S.naut.c >= rowLen(r) && isMaelstrom(r, S.naut.c)) { log(B('Le correnti trascinano il Nautilus nel Maelstrom!', 'The currents drag the Nautilus into the Maelstrom!'), 'gold'); maelstromEnd(); }
}
function nemesisReclaim() {
  const n = S.nemesis; if (!n || n.c < 0) return;
  const id = cardAt(n.r, n.c); if (id === null) return;
  const cd = card(id);
  S.rows[n.r].cards[n.c] = null; S.nemLoot.push(id); S.curCard = id;
  log(B('La Nemesis reclama «' + cd.title + '».', 'The Nemesis reclaims “' + cd.title + '”.'), 'bad');
  const items = cd.fx.filter(f => f.startsWith('I:')).map(f => ({ t: 'fx', fx: f, card: id }));
  if (cd.ship) items.push({ t: 'ship', row: n.r, card: id });
  S.queue.unshift(...items);
}
function soloRefill() {
  if (!S.reclaimedThisTurn) {
    log(B('Oblio: nessuna memoria reclamata, la prima carta di ogni fiume va alla Nemesis.', 'Oblivion: no Memory reclaimed, the first card of each River goes to the Nemesis.'), 'bad');
    for (let r = 0; r < 3; r++) {
      const i = S.rows[r].cards.findIndex(x => x !== null);
      if (i >= 0) { S.nemLoot.push(S.rows[r].cards[i]); S.rows[r].cards[i] = null; }
    }
  }
  for (let r = 0; r < 3; r++) {
    const row = S.rows[r];
    const track = pos => { if (pos.r !== r || pos.c < 0) return pos; const id = cardAt(r, pos.c); return { id, c: pos.c }; };
    const nt = track(S.naut), mt = S.nemesis ? track(S.nemesis) : null;
    const kept = row.cards.filter(x => x !== null);
    while (kept.length < 5 && row.stack.length) kept.push(row.stack.pop());
    row.cards = kept;
    if (nt.id !== undefined) S.naut.c = nt.id !== null ? kept.indexOf(nt.id) : Math.min(S.naut.c, kept.length);
    if (mt && mt.id !== undefined) S.nemesis.c = mt.id !== null ? kept.indexOf(mt.id) : Math.min(S.nemesis.c, kept.length);
  }
  if (isMaelstrom(S.naut.r, S.naut.c)) { log(B('Le correnti trascinano il Nautilus nel Maelstrom!', 'The currents drag the Nautilus into the Maelstrom!'), 'gold'); maelstromEnd(); }
}

// ------------------------------------------------ turno e fine
function endTurn() {
  if (S.phase !== 'PLAY') return;
  if (S.mode === 'solo') { soloRefill(); if (S.phase !== 'PLAY') return; S.round++; }
  else { S.turn = (S.turn + 1) % S.players.length; if (S.turn === 0) S.round++; }
  S.actions = 3; S.reclaimedThisTurn = false;
  if (S.mode !== 'solo') log(B('Tocca a ' + who(player()) + '.', who(player()) + '’s turn.'));
  fx({ t: 'turn' });
}
function fateType() { if (!S.mind.q) return null; return HALF.W.includes(S.mind.q) ? 'K' : 'A'; }
function fateCount(cards, t) { return cards.reduce((a, id) => a + (card(id).fate && (t === null || card(id).fate === t) ? 1 : 0), 0); }
function maelstromEnd() {
  S.phase = 'END'; S.queue = []; S.pending = null;
  const t = fateType();
  if (S.mode === 'solo') {
    const me = fateCount(S.players[0].cards, t), nem = fateCount(S.nemLoot, t);
    let win = me > nem;
    if (me === nem) win = S.players[0].cards.length > S.nemLoot.length ? true : (S.players[0].cards.length === S.nemLoot.length ? null : false);
    S.result = { solo: true, maelstrom: true, type: t, me, nem, win };
    log(B('Il Maelstrom inghiotte il Nautilus. ' + (win === null ? 'Pareggio.' : win ? 'Nemo domina il suo passato!' : 'Vince la Nemesis.'), 'The Maelstrom swallows the Nautilus. ' + (win === null ? 'A tie.' : win ? 'Nemo masters his past!' : 'The Nemesis wins.')), 'gold');
    return;
  }
  const teams = {};
  for (const p of S.players) { const k = p.team; teams[k] = teams[k] || { team: k, cards: [], members: [] }; teams[k].cards.push(...p.cards); teams[k].members.push(p.idx); }
  const list = Object.values(teams).map(T => ({ ...T, fate: fateCount(T.cards, t), n: T.cards.length }));
  list.sort((a, b) => b.fate - a.fate || b.n - a.n);
  let winners = list.filter(x => x.fate === list[0].fate && x.n === list[0].n);
  if (winners.length > 1 && t === null) { const act = player().team; const w = winners.find(x => x.team === act); if (w) winners = [w]; }
  S.result = { maelstrom: true, type: t, table: list, winners: winners.flatMap(x => x.members) };
  log(B('Il Maelstrom inghiotte il Nautilus: vince ' + S.result.winners.map(i => who(S.players[i])).join(' e ') + '.', 'The Maelstrom swallows the Nautilus: ' + S.result.winners.map(i => who(S.players[i])).join(' and ') + ' win' + (S.result.winners.length > 1 ? '' : 's') + '.'), 'gold');
}

const E = { CARDS, CH, CH_IT, QUADS, HALF, CHARS, COND_IT, MAX_RING, getState, setState, clone, shuffle, newGame,
  power, shipsAfloat, totalBulbs, totalSailors, uprising, shield, rowLen, maelstromAt, cardAt, isMaelstrom, validPos,
  shipsNear, requirement, player, condMet, inHalf, canWin, navTargets, reclaimCheck, attackTargets, restTargets, canDeclare,
  act, choose, run, endTurn, fateType, fateCount, who, card };
root.MimEngine = E;
if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
