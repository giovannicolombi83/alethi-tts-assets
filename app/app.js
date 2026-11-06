/* ALETHI — interfaccia per telefono */
(function () {
'use strict';
const E = window.AlethiEngine, AI = window.AlethiAI;
const { ROWS, COLS } = E;
const $ = id => document.getElementById(id);
const S = () => E.getState();
const LOW = { Yellow: 'yellow', Purple: 'purple', Red: 'red', Blue: 'blue' };
const HEX = { Yellow: '#e0b52c', Purple: '#9b55c9', Red: '#d23c34', Blue: '#3b72d6' };
const SPACES = {
  1: [[0.5, 0.2825]], 2: [[0.3516, 0.2825], [0.6484, 0.2825]], 3: [[0.2930, 0.2637], [0.5, 0.2637], [0.7070, 0.2637]],
  4: [[0.3516, 0.2072], [0.6484, 0.2072], [0.3516, 0.4049], [0.6484, 0.4049]],
  5: [[0.2930, 0.2072], [0.5, 0.2072], [0.7070, 0.2072], [0.3965, 0.4049], [0.6035, 0.4049]],
  6: [[0.2930, 0.1977], [0.5, 0.1977], [0.7070, 0.1977], [0.2930, 0.3955], [0.5, 0.3955], [0.7070, 0.3955]]
};
const PARSH_UV = [[0.27, 0.62], [0.5, 0.62], [0.73, 0.62], [0.27, 0.80], [0.5, 0.80], [0.73, 0.80]];
const WAR_UV = { Yellow: [0.16, 0.56], Purple: [0.38, 0.56], Red: [0.62, 0.56], Blue: [0.84, 0.56] };
const SAVE = 'alethi-save-v1', CFG = 'alethi-cfg-v1';

const ui = { busy: false, lure: null, hl: null, timer: null };

// ------------------------------------------------ memoria locale
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
function load(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function drop(k) { try { localStorage.removeItem(k); } catch (e) { } }

// ------------------------------------------------ schermata iniziale
let seats = load(CFG) || [
  { color: 'Yellow', house: 'Kholin', ai: false },
  { color: 'Purple', house: 'Sadeas', ai: true }
];
function renderSetup() {
  const used = seats.map(s => s.house);
  $('seats').innerHTML = seats.map((s, i) => `
    <div class="seat">
      <span class="dot" style="background:${HEX[s.color]}"></span>
      <span class="nm">${E.cname(s.color)}</span>
      <button class="toggle ${s.ai ? 'ai' : 'me'}" data-t="${i}">${s.ai ? 'AI' : 'Tu'}</button>
      <div class="sc"><select data-h="${i}">${E.HOUSES.map(h => `<option value="${h}" ${h === s.house ? 'selected' : ''} ${h !== s.house && used.includes(h) ? 'disabled' : ''}>${h}</option>`).join('')}</select><div class="hd">${E.HOUSE_DESC[s.house]}</div></div>
      ${seats.length > 2 ? `<button class="x" data-x="${i}" aria-label="Togli">✕</button>` : ''}
    </div>`).join('');
  $('addSeat').classList.toggle('hidden', seats.length >= 4);
  $('resumeBtn').classList.toggle('hidden', !load(SAVE));
}
$('seats').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.t !== undefined) { const s = seats[+t.dataset.t]; s.ai = !s.ai; renderSetup(); }
  if (t.dataset.x !== undefined) { seats.splice(+t.dataset.x, 1); renderSetup(); }
});
$('seats').addEventListener('change', e => { if (e.target.dataset.h !== undefined) { seats[+e.target.dataset.h].house = e.target.value; renderSetup(); } });
$('addSeat').onclick = () => {
  const color = E.COLORS.find(c => !seats.some(s => s.color === c));
  const house = E.HOUSES.find(h => !seats.some(s => s.house === h));
  seats.push({ color, house, ai: true }); renderSetup();
};
$('startBtn').onclick = () => {
  if (!seats.some(s => !s.ai)) { toast('Almeno un giocatore deve essere umano.', 'bad'); return; }
  store(CFG, seats);
  const order = E.COLORS.filter(c => seats.some(s => s.color === c)).map(c => seats.find(s => s.color === c));
  E.newGame(order);
  startGameScreen();
};
$('resumeBtn').onclick = () => { const s = load(SAVE); if (!s) return; E.setState(s); S().fx = []; startGameScreen(); };
$('rulesBtn0').onclick = () => showRules();
$('menuBtn').onclick = () => showMenu();

function startGameScreen() {
  $('setup').classList.add('hidden'); $('game').classList.remove('hidden');
  window.scrollTo(0, 0);
  ui.busy = false; ui.lure = null;
  update();
}
function backToSetup() {
  clearTimeout(ui.timer); ui.busy = false;
  $('game').classList.add('hidden'); $('setup').classList.remove('hidden');
  renderSetup();
}

// ------------------------------------------------ chi deve decidere
function decider() {
  const s = S();
  if (s.phase === 'SETTLE') return E.settleChooser();
  if (s.phase !== 'TURN') return null;
  if (s.imode) return s.imode.col;
  return E.active();
}
const isHuman = c => c && !S().P[c].ai;
function viewCol() {
  const d = decider();
  if (d && isHuman(d)) return d;
  const s = S();
  return s.play.find(c => isHuman(c)) || s.order[0];
}

// ------------------------------------------------ ciclo principale
function update() {
  const s = S();
  store(SAVE, s.phase === 'END' ? null : s);
  if (s.phase === 'END') drop(SAVE);
  render();
  playFx();
  if (s.phase === 'END') { setTimeout(showFinal, 900); return; }
  const d = decider();
  if (d && !isHuman(d) && !ui.busy) aiStep();
}
function aiStep() {
  ui.busy = true;
  renderPrompt();
  ui.timer = setTimeout(() => {
    const a = AI.decide();
    if (!a) { ui.busy = false; update(); return; }
    ui.hl = a.hl || null;
    render();
    ui.timer = setTimeout(() => {
      ui.hl = null;
      a.fn();
      ui.busy = false;
      update();
    }, a.end ? 250 : 650);
  }, 420);
}
function act(fn) { if (ui.busy) return; fn(); ui.lure = null; closeSheet(); update(); }

// ------------------------------------------------ effetti
function playFx() {
  const s = S(); const list = s.fx.splice(0);
  let delay = 0;
  for (const f of list) {
    if (f.t === 'dice') {
      const html = `Evocazione: <span class="dice">${f.d1}</span>` + (f.d2 ? ` &lt; Cumulo ${f.cum} → <span class="dice v">${f.d2}</span>` : ` ≥ Cumulo ${f.cum}: nulla`);
      setTimeout(() => toast(html), delay); delay += 300;
    } else if (f.t === 'aby') setTimeout(() => toast('Un Abissale emerge nel Nodo ' + s.nodes[f.i][f.j].num + '!', 'big'), delay += 200);
    else if (f.t === 'kill') setTimeout(() => toast('Abissale abbattuto! Cuorgemma +3 PV', 'big'), delay += 100);
    else if (f.t === 'warDead') setTimeout(() => toast('Lo Strato Guerriero di ' + E.cname(f.col) + ' è caduto', 'bad'), delay += 200);
    else if (f.t === 'boom') boomAt(f.cr);
    else if (f.t === 'parsh') setTimeout(() => toast('Fase Parshendi'), delay += 100);
  }
}
function toast(html, cls) {
  const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.innerHTML = html;
  $('toasts').appendChild(d); setTimeout(() => d.remove(), 3100);
}
function boomAt(cr) {
  const g = geo(); if (!g) return;
  const [x, y] = crevXY(g, cr);
  const b = document.createElement('div'); b.className = 'boom'; b.textContent = '💥';
  b.style.left = x + 'px'; b.style.top = y + 'px';
  $('map').appendChild(b); setTimeout(() => b.remove(), 950);
}

// ------------------------------------------------ geometria della mappa
function geo() {
  let w = $('mapWrap').clientWidth; if (!w) return null;
  const maxH = window.innerWidth >= 900 ? window.innerHeight - 90 : Infinity;
  const pad = 8; let W = w - pad * 2;
  { const T0 = W / (COLS + (COLS - 1) * 0.24); const h0 = pad * 2 + ROWS * T0 * 531 / 512 + (ROWS - 1) * T0 * 0.24; if (h0 > maxH) { W = W * maxH / h0; w = W + pad * 2; } }
  const T = W / (COLS + (COLS - 1) * 0.24), G = T * 0.24, Th = T * 531 / 512;
  return { T, G, Th, pad, w, h: pad * 2 + ROWS * Th + (ROWS - 1) * G };
}
const tileX = (g, c) => g.pad + c * (g.T + g.G);
const tileY = (g, r) => g.pad + r * (g.Th + g.G);
function crevXY(g, cr) {
  const [o, r, c] = cr;
  return o === 'H' ? [tileX(g, c) + g.T + g.G / 2, tileY(g, r) + g.Th / 2] : [tileX(g, c) + g.T / 2, tileY(g, r) + g.Th + g.G / 2];
}
const nodeXY = (g, i, j) => [tileX(g, j) + g.T + g.G / 2, tileY(g, i) + g.Th + g.G / 2];

// ------------------------------------------------ bersagli del giocatore umano
function targets() {
  const s = S(); const d = decider();
  const t = { tiles: {}, crevs: {}, nodes: {}, cards: {}, slots: {}, empty: {} };
  if (ui.busy || !d || !isHuman(d)) return t;
  if (s.phase === 'SETTLE') { for (const [r, c] of E.settleTargets()) t.tiles[r + ',' + c] = { fn: () => E.doSettle(d, r, c), label: 'Parti qui' }; return t; }
  const col = E.active(); const p = s.P[col]; const m = s.mode;
  if (s.imode) {
    const im = s.imode;
    if (im.t === 'TRAITOR') {
      const by = {};
      for (const [r, c, v] of E.traitorTargets(im.col)) (by[r + ',' + c] = by[r + ',' + c] || []).push(v);
      for (const k in by) { const [r, c] = k.split(',').map(Number); t.tiles[k] = { fn: () => chooseVictim(im.col, r, c, by[k]), label: 'Elimina', noAct: true }; }
    } else for (const cr of E.breakTargets()) t.crevs[E.ck(...cr)] = { fn: () => E.breakBridge(im.col, cr) };
    return t;
  }
  if (!m) {
    if (s.step === 'MOVE') for (const k of E.selectorTargets(col)) t.cards[k] = { fn: () => E.moveSelector(col, k) };
    else for (const k in p.board) if (p.board[k].cr > 0) t.cards[k] = { info: true };
    return t;
  }
  if (m.t === 'ATTACK') {
    for (const tg of E.attackTargets(col, p.board[m.k].cr)) {
      const label = tg.f + ' vs ' + tg.e + (tg.lenders.length ? ' ⚑' : '');
      const fn = () => tg.kind === 'P' ? E.attackParsh(col, m.k, tg.r, tg.c, tg.lenders) : E.attackAby(col, m.k, tg.i, tg.j, tg.lenders);
      if (tg.kind === 'P') t.tiles[tg.r + ',' + tg.c] = { fn, label, lend: tg.lenders.length > 0 };
      else t.nodes[tg.i + ',' + tg.j] = { fn, label, lend: tg.lenders.length > 0 };
    }
  } else if (m.t === 'CONQUER') {
    for (const [r, c, f] of E.conquerTargets(col, p.board[m.k].cr)) t.tiles[r + ',' + c] = { fn: () => E.conquer(col, m.k, r, c), label: 'Costo ' + f };
  } else if (m.t === 'BUY') {
    for (let i = 0; i < 4; i++) if (s.market.slots[i] != null && 4 - i <= p.board[m.k].cr) t.slots[i] = { fn: () => E.buy(col, m.k, i) };
  } else if (m.t === 'PLACECARD') {
    for (const [x, y] of E.placeTargets(col)) t.empty[x + ',' + y] = { fn: () => E.placeCard(col, x, y) };
  } else if (m.t === 'WARRIOR') {
    for (const [r, c] of E.warriorTargets(col)) t.tiles[r + ',' + c] = { fn: () => E.deployWarrior(col, r, c), label: 'Guerriero' };
  } else if (m.t === 'P4') {
    for (const cr of E.p4Targets()) t.crevs[E.ck(...cr)] = { fn: () => E.placeP4(col, cr) };
  } else if (m.t === 'BRIDGES') {
    for (const cr of E.bridgeTargets(col)) t.crevs[E.ck(...cr)] = { fn: () => E.placeBridge(col, cr), keep: true };
  } else if (m.t === 'LURE') {
    const abys = E.abyList();
    let src = (m.si !== undefined && s.nodes[m.si][m.sj].ab) ? [m.si, m.sj] : ui.lure;
    if (!src && abys.length === 1) src = abys[0];
    if (!src) for (const [i, j] of abys) t.nodes[i + ',' + j] = { fn: () => { ui.lure = [i, j]; }, label: 'Scegli', local: true };
    else {
      t.nodes[src[0] + ',' + src[1]] = { sel: true };
      for (const [a, b] of E.nodeNeighbors(src[0], src[1])) t.nodes[a + ',' + b] = { fn: () => E.lureMove(col, src[0], src[1], a, b), label: 'Qui', keep: true };
    }
  } else if (m.t === 'BONUS') {
    t.bonus = m.lender;
  }
  return t;
}

// ------------------------------------------------ disegno
function render() {
  const s = S(); if (!s) return;
  renderStatus(); renderPlayers();
  const T = targets();
  renderMap(T); renderPrompt(T); renderBoard(T); renderMarket(T);
  if (T.bonus && !$('sheet').dataset.bonus) showBonus(T.bonus);
}
function renderStatus() {
  const s = S();
  let h = '';
  if (s.phase === 'SETTLE') h = '<b>Preparazione</b>';
  else if (s.phase === 'TURN') {
    const c = E.active();
    h = `<b>Round ${s.round}</b><span class="turnchip" style="background:${HEX[c]}">${E.cname(c)}</span>`;
  } else h = '<b>Fine partita</b>';
  h += `<span class="stat" title="Morti nel Cumulo"><img src="img/parshendi.png" alt="">${s.cumulo}</span>`;
  h += `<span class="stat" title="Abissali abbattuti"><img src="img/heart.png" alt="">${s.hearts.length}/3</span>`;
  if (s.lastRound) h += '<span class="stat" style="color:var(--gold2)">Ultimo round</span>';
  $('status').innerHTML = h;
}
function renderPlayers() {
  const s = S();
  const cur = s.phase === 'TURN' ? E.active() : (s.phase === 'SETTLE' ? E.settleChooser() : null);
  $('players').innerHTML = s.play.map(c => {
    const p = s.P[c]; const sc = E.scoreOf(c);
    const war = p.war ? `⚔${p.wStr}${p.rysh ? '+3' : ''}` : 'senza Guerriero';
    return `<button class="pchip ${c === cur ? 'on' : ''}" data-p="${c}" style="background:linear-gradient(90deg,${HEX[c]}33,var(--panel) 70%)">
      <div class="h"><i style="background:${HEX[c]}"></i>${p.ai ? 'AI' : 'Tu'} · ${p.house}</div>
      <div class="m">${war}</div><span class="vp">${sc.total}</span></button>`;
  }).join('');
}
$('players').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) showPlayer(b.dataset.p); });

function renderMap(T) {
  const s = S(); const g = geo(); if (!g) return;
  const map = $('map'); map.style.width = g.w + 'px'; map.style.height = g.h + 'px';
  const hl = ui.hl || {};
  let h = '';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = s.map[r][c]; const x = tileX(g, c), y = tileY(g, r);
    const tg = T.tiles[r + ',' + c];
    const isHl = hl.tile && hl.tile[0] === r && hl.tile[1] === c;
    h += `<div class="tile ${tg ? 'tgt' : ''} ${isHl ? 'hl' : ''}" data-tile="${r},${c}" style="left:${x}px;top:${y}px;width:${g.T}px;height:${g.Th}px">`;
    h += `<img class="pl" src="img/plateau_${t.n}.jpg" alt="">`;
    let slot = 0;
    for (const col of s.order) for (let k = 0; k < E.outOf(r, c, col); k++) {
      const uv = SPACES[t.n][slot++]; if (!uv) continue;
      h += `<img class="piece" src="img/disc_${LOW[col]}.png" style="left:${uv[0] * 100}%;top:${uv[1] * 100}%;width:${g.T * 0.2}px" alt="">`;
    }
    for (let k = 0; k < Math.min(t.parsh, 6); k++) {
      const uv = PARSH_UV[k];
      h += `<img class="piece" src="img/parshendi.png" style="left:${uv[0] * 100}%;top:${uv[1] * 100}%;height:${g.T * 0.24}px" alt="">`;
    }
    for (const col of s.order) {
      const w = s.P[col].war; if (!w || w[0] !== r || w[1] !== c) continue;
      const uv = WAR_UV[col];
      h += `<img class="piece war" src="img/war_${LOW[col]}.png" style="left:${uv[0] * 100}%;top:${uv[1] * 100}%;height:${g.T * 0.36}px" alt="">`;
    }
    if (tg && tg.label) h += `<span class="badge ${tg.lend ? 'lend' : ''}">${tg.label}</span>`;
    h += '</div>';
  }
  for (const cr of E.allCrev()) {
    const b = E.br(...cr); const k = E.ck(...cr); const tg = T.crevs[k];
    const isHl = hl.crev && E.ck(...hl.crev) === k;
    if (!b.n && !b.p4 && !tg && !isHl) continue;
    const [x, y] = crevXY(g, cr);
    const horiz = cr[0] === 'H';
    const len = g.G + g.T * 0.34, thick = len * 0.37;
    const w = horiz ? len : thick, hh = horiz ? thick : len;
    h += `<div class="crev ${tg ? 'tgt' : ''} ${isHl ? 'hl' : ''} ${!b.n && !b.p4 ? 'empty' : ''}" data-crev="${k}" style="left:${x}px;top:${y}px;width:${Math.max(w, 30)}px;height:${Math.max(hh, 30)}px">`;
    if (b.n || b.p4) h += `<img src="img/${b.p4 ? 'bridge4' : 'bridge'}.png" style="width:${len}px;height:${thick}px;${horiz ? '' : 'transform:rotate(90deg)'}" alt="">`;
    if (b.n > 1) h += `<span class="n">×${b.n}</span>`;
    h += '</div>';
  }
  for (let i = 0; i < ROWS - 1; i++) for (let j = 0; j < COLS - 1; j++) {
    const nd = s.nodes[i][j]; const [x, y] = nodeXY(g, i, j); const tg = T.nodes[i + ',' + j];
    const isHl = hl.node && hl.node[0] === i && hl.node[1] === j;
    const sz = g.T * 0.32;
    h += `<div class="node ${tg && !tg.sel ? 'tgt' : ''} ${isHl || (tg && tg.sel) ? 'hl' : ''}" data-node="${i},${j}" style="left:${x}px;top:${y}px;width:${sz}px;height:${sz}px">`;
    h += `<img class="nd" src="img/node_${nd.num}.png" alt="">`;
    if (nd.ab) h += `<img class="ab" src="img/abissale.png" alt=""><span class="force">${E.abyForce(i, j)}</span>`;
    if (tg && tg.label) h += `<span class="badge ${tg.lend ? 'lend' : ''}" style="bottom:auto;top:-22px">${tg.label}</span>`;
    h += '</div>';
  }
  map.innerHTML = h;
  map._T = T;
}
$('map').addEventListener('click', e => {
  const T = $('map')._T; if (!T) return;
  const el = e.target.closest('[data-tile],[data-crev],[data-node]'); if (!el) return;
  let tg = null;
  if (el.dataset.tile) tg = T.tiles[el.dataset.tile];
  else if (el.dataset.crev) tg = T.crevs[el.dataset.crev];
  else if (el.dataset.node) tg = T.nodes[el.dataset.node];
  if (el.dataset.tile && !tg) { tileInfo(el.dataset.tile); return; }
  if (!tg || !tg.fn) return;
  if (tg.local || tg.noAct) { tg.fn(); render(); return; }
  act(tg.fn);
});

function promptText() {
  const s = S(); const d = decider();
  if (s.phase === 'SETTLE') return isHuman(d) ? 'Scegli il territorio di partenza: un altopiano libero da 1 spazio.' : E.cname(d) + ' sceglie il territorio di partenza…';
  if (s.phase === 'END') return 'Partita finita.';
  const col = E.active();
  if (!isHuman(d)) return (s.mode && s.mode.t === 'BONUS' ? 'Spostamento Bonus: ' : '') + E.cname(d) + ' (' + s.P[d].house + ') sta giocando…';
  if (s.imode) return s.imode.t === 'TRAITOR' ? 'Tradimento: tocca l\'altopiano con l\'avamposto nemico da eliminare.' : 'Distruggi ponte: tocca il ponte da far crollare.';
  const m = s.mode;
  if (!m) {
    if (s.step === 'MOVE') return '<b>Sposta l\'Animutante</b> su un\'altra carta della tua plancia: le carte accanto ricevono cristalli.';
    return 'Tocca una carta con cristalli per attivarla. Quando hai finito, premi <b>Fine turno</b>.';
  }
  return {
    ATTACK: 'Scegli il bersaglio: la tua forza contro quella nemica (⚑ = con prestito di forza).',
    CONQUER: 'Scegli l\'altopiano su cui mettere un avamposto.',
    BUY: 'Tocca la carta del Mercato da comprare.',
    PLACECARD: 'Tocca uno spazio libero accanto alla tua plancia per attaccare la nuova carta.',
    WARRIOR: 'Scegli l\'altopiano dove schierare il nuovo Strato Guerriero.',
    P4: 'Tocca il crepaccio dove posare il Ponte Quattro.',
    BRIDGES: 'Tocca i crepacci dove posare i ponti. Ne restano <b>' + m.left + '</b>.',
    LURE: 'Attira Abissale: scegli l\'Abissale e poi il Nodo vicino. Spostamenti rimasti: <b>' + m.left + '</b>.',
    BONUS: 'Spostamento Bonus di ' + E.cname(m.lender) + ': scegli tu dove va il suo Animutante.'
  }[m.t] || '';
}
function renderPrompt(T) {
  const s = S(); const d = decider();
  const pr = $('prompt');
  pr.classList.toggle('thinking', ui.busy || (d && !isHuman(d) && s.phase !== 'END'));
  pr.classList.toggle('bonus', !!(s.mode && s.mode.t === 'BONUS'));
  $('promptText').innerHTML = promptText();
  const btns = [];
  if (!ui.busy && d && isHuman(d) && s.phase === 'TURN') {
    const m = s.mode;
    if (s.imode) btns.push(['Annulla', () => { s.imode = null; }]);
    else if (m && (m.t === 'ATTACK' || m.t === 'CONQUER' || m.t === 'BUY')) btns.push(['Annulla', () => { s.mode = null; }]);
    else if (m && (m.t === 'BRIDGES' || m.t === 'LURE')) btns.push(['Ho finito', () => { s.mode = null; }]);
    else if (!m && s.step === 'ACT') btns.push(['Fine turno', () => E.endTurn(), 'go']);
    if (!m && !s.imode) {
      for (const c of s.order) {
        const p = s.P[c]; if (p.ai) continue;
        if (p.trad > 0 && E.traitorTargets(c).length) btns.push(['Tradimento' + (s.order.filter(x => !s.P[x].ai).length > 1 ? ' (' + E.cname(c) + ')' : ''), () => { s.imode = { t: 'TRAITOR', col: c }; }, 'warn']);
        if (p.brk && E.breakTargets().length) btns.push(['Distruggi ponte' + (s.order.filter(x => !s.P[x].ai).length > 1 ? ' (' + E.cname(c) + ')' : ''), () => { s.imode = { t: 'BREAK', col: c }; }, 'warn']);
      }
    }
  }
  $('promptBtns').innerHTML = btns.map((b, i) => `<button data-b="${i}" class="${b[2] || ''}">${b[0]}</button>`).join('');
  $('promptBtns')._b = btns;
  const lg = s.log.slice(-3).reverse();
  $('miniLog').innerHTML = lg.map(l => `<div style="color:${HEX[l.c] || (l.c === 'bad' ? '#ff9e98' : l.c === 'gold' ? '#e8cf8a' : '')}">${l.m}</div>`).join('');
}
$('promptBtns').addEventListener('click', e => {
  const b = e.target.closest('[data-b]'); if (!b) return;
  const f = $('promptBtns')._b[+b.dataset.b]; if (f) act(f[1]);
});
$('miniLog').addEventListener('click', () => showLog());

function boardGrid(col, T, clickable) {
  const p = S().P[col];
  const keys = Object.keys(p.board).concat(Object.keys(T.empty || {}));
  const xs = keys.map(k => +k.split(',')[0]), ys = keys.map(k => +k.split(',')[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cols = x1 - x0 + 1;
  const avail = Math.min(document.body.clientWidth, 560) - 44;
  const cw = Math.min(92, Math.floor((avail - (cols - 1) * 6) / cols));
  let h = '';
  for (let y = y1; y >= y0; y--) for (let x = x0; x <= x1; x++) {
    const k = x + ',' + y; const cd = p.board[k];
    const pos = `grid-column:${x - x0 + 1};grid-row:${y1 - y + 1};width:${cw}px`;
    if (cd) {
      const tg = T.cards && T.cards[k];
      const isHl = ui.hl && ui.hl.board === col && ui.hl.k === k;
      h += `<div class="card ${tg ? 'tgt' : ''} ${isHl ? 'hl' : ''} ${clickable && T.cards && Object.keys(T.cards).length && !tg ? 'dim' : ''}" data-card="${k}" style="${pos}">
        <img class="art" src="img/c${cd.idx}.jpg" alt="${E.CARD_NAME[E.cardType(cd.idx)]}">
        ${cd.cr ? `<span class="cr"><img src="img/crystal.png" alt="">${cd.cr}</span>` : ''}
        ${p.sel === k ? `<img class="anim" src="img/anim_${LOW[col]}.png" alt="Animutante">` : ''}</div>`;
    } else if (T.empty && T.empty[k]) h += `<div class="card empty tgt" data-empty="${k}" style="${pos}"></div>`;
  }
  return { html: h, cols, cw };
}
function renderBoard(T) {
  const s = S(); const col = viewCol(); const p = s.P[col];
  const showT = (decider() === col && !ui.busy) ? T : { empty: {} };
  const b = boardGrid(col, showT, true);
  const el = $('board');
  el.style.gridTemplateColumns = `repeat(${b.cols}, ${b.cw}px)`;
  el.innerHTML = b.html;
  el._T = showT; el._col = col;
  $('boardTitle').textContent = (s.play.filter(c => !s.P[c].ai).length > 1 ? 'Plancia di ' + E.cname(col) : 'La tua plancia') + ' · ' + p.house + (p.fab ? ' · Fabrial +' + p.fab : '');
  $('personal').innerHTML = p.personal.map(i => `<img src="img/c${i}.jpg" data-pc="${i}" alt="">`).join('');
}
$('board').addEventListener('click', e => {
  const el = $('board'); const T = el._T; const col = el._col;
  const c = e.target.closest('[data-card],[data-empty]'); if (!c) return;
  if (c.dataset.empty) { const tg = T.empty[c.dataset.empty]; if (tg) act(tg.fn); return; }
  const k = c.dataset.card; const tg = T.cards && T.cards[k];
  if (tg && tg.fn) { act(tg.fn); return; }
  cardSheet(col, k, tg && tg.info);
});
$('personal').addEventListener('click', e => { const i = e.target.dataset.pc; if (i !== undefined) infoCard(+i); });

function renderMarket(T) {
  const s = S(); const m = s.market;
  let h = `<div class="mslot"><span class="cost">${m.deck.length}</span><div class="card"><img class="art" src="img/back.jpg" alt="Mazzo"></div></div>`;
  for (let i = 0; i < 4; i++) {
    const idx = m.slots[i]; const tg = T.slots[i];
    const isHl = ui.hl && ui.hl.slot === i;
    h += `<div class="mslot"><span class="cost">${4 - i} <img src="img/crystal.png" style="height:13px;vertical-align:-2px" alt=""></span>` +
      (idx != null ? `<div class="card ${tg ? 'tgt' : ''} ${isHl ? 'hl' : ''}" data-slot="${i}"><img class="art" src="img/c${idx}.jpg" alt=""></div>` : '<div class="card empty"></div>') + '</div>';
  }
  $('market').innerHTML = h; $('market')._T = T;
  $('deckInfo').textContent = '';
}
$('market').addEventListener('click', e => {
  const c = e.target.closest('[data-slot]'); if (!c) return;
  const i = +c.dataset.slot; const tg = $('market')._T.slots[i];
  if (tg) act(tg.fn); else infoCard(S().market.slots[i]);
});
window.addEventListener('resize', () => { if (S() && !$('game').classList.contains('hidden')) render(); });

// ------------------------------------------------ fogli a comparsa
function openSheet(html, opts) {
  $('sheetContent').innerHTML = html; $('sheet').classList.remove('hidden');
  $('sheet').dataset.bonus = (opts && opts.bonus) ? '1' : '';
  $('sheet').dataset.lock = (opts && opts.lock) ? '1' : '';
}
function closeSheet() { $('sheet').classList.add('hidden'); $('sheet').dataset.bonus = ''; $('sheet').dataset.lock = ''; }
$('sheet').addEventListener('click', e => {
  if (e.target.classList.contains('sheet-bg') && !$('sheet').dataset.lock) closeSheet();
  const b = e.target.closest('[data-do]'); if (b && $('sheet')._do) { const f = $('sheet')._do[b.dataset.do]; if (f) f(); }
});
function sheetDo(map) { $('sheet')._do = map; }

function infoCard(idx) {
  const t = E.cardType(idx);
  openSheet(`<div class="cardview"><img src="img/c${idx}.jpg" alt=""><div><h3>${E.CARD_NAME[t]}</h3><p>${E.CARD_DESC[t]}</p>
    <p style="color:var(--muted);font-size:13px">${E.isBoardCard(t) ? 'Carta azione: va sulla plancia.' : 'Carta personale.'}</p></div></div>
    <div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}
function cardSheet(col, k, canTry) {
  const s = S(); const cd = s.P[col].board[k]; const t = E.cardType(cd.idx);
  const mine = canTry && decider() === col && !ui.busy;
  const why = mine ? E.canActivate(col, k) : null;
  let extra = '';
  if (t === 'ATK') extra = 'Con ' + cd.cr + ' cristalli: forza ' + cd.cr + ' + i tuoi avamposti e il Guerriero nella rete del bersaglio.';
  if (t === 'CON') extra = 'Con ' + cd.cr + ' cristalli conquisti un altopiano con al massimo ' + cd.cr + ' spazi liberi.';
  if (t === 'PON') extra = 'Con ' + cd.cr + ' cristalli posi ' + cd.cr + ' ponti.';
  if (t === 'ATT') extra = 'Con ' + cd.cr + ' cristalli fai fino a ' + cd.cr + ' spostamenti.';
  if (t === 'COM') extra = 'Con ' + cd.cr + ' cristalli. Attenzione: attivare una carta spende tutti i suoi cristalli.';
  openSheet(`<div class="cardview"><img src="img/c${cd.idx}.jpg" alt=""><div><h3>${E.CARD_NAME[t]}</h3><p>${E.CARD_DESC[t]}</p>
    ${cd.cr ? `<p><b>${extra}</b></p>` : ''}${why ? `<p class="reason">${why}</p>` : ''}</div></div>
    <div class="sheet-btns">${mine ? `<button class="go" data-do="go" ${why ? 'disabled' : ''}>Attiva (${cd.cr} cristalli)</button>` : ''}<button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet, go: () => { if (!why) act(() => E.activate(col, k)); } });
}
function showBonus(lender) {
  const T = { cards: {}, empty: {} };
  for (const k of E.selectorTargets(lender)) T.cards[k] = { fn: true };
  const b = boardGrid(lender, T, true);
  openSheet(`<h3>Spostamento Bonus</h3><p>${E.cname(lender)} (${S().P[lender].house}) ti ha prestato forza: scegli tu dove va il suo Animutante. Le carte accanto ricevono cristalli.</p>
    <div class="mini-board" id="bonusBoard" style="grid-template-columns:repeat(${b.cols},${b.cw}px)">${b.html}</div>`, { bonus: true, lock: true });
  $('bonusBoard').onclick = e => {
    const c = e.target.closest('[data-card]'); if (!c || !T.cards[c.dataset.card]) return;
    act(() => { E.moveSelector(lender, c.dataset.card, true); E.nextBonus(); });
  };
}
function chooseVictim(col, r, c, victims) {
  if (victims.length === 1) { act(() => E.playTraitor(col, r, c, victims[0])); return; }
  openSheet(`<h3>Tradimento</h3><p>Di chi elimini l'avamposto?</p><div class="sheet-btns">${victims.map(v => `<button data-do="${v}" style="border-color:${HEX[v]}">${E.cname(v)} · ${S().P[v].house}</button>`).join('')}<button data-do="x">Annulla</button></div>`);
  const m = { x: closeSheet }; for (const v of victims) m[v] = () => act(() => E.playTraitor(col, r, c, v));
  sheetDo(m);
}
function tileInfo(k) {
  const s = S(); const [r, c] = k.split(',').map(Number); const t = s.map[r][c];
  const outs = s.order.filter(col => E.outOf(r, c, col) > 0).map(col => `${E.cname(col)} ${E.outOf(r, c, col)}`).join(', ') || 'nessuno';
  openSheet(`<h3>${t.n === 6 ? 'Narak' : 'Altopiano da ' + t.n}</h3>
    <p>Spazi liberi: <b>${E.freeSpaces(r, c)}</b> su ${t.n} · Avamposti: ${outs}</p>
    <p>Parshendi: <b>${t.parsh}</b> · forza difensiva (con i vicini): <b>${E.parshForce(r, c)}</b></p>
    <p style="color:var(--muted);font-size:13px">Chi ha più avamposti qui guadagna ${t.n} PV a fine partita.</p>
    <div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}
function showPlayer(col) {
  const s = S(); const p = s.P[col]; const sc = E.scoreOf(col);
  const b = boardGrid(col, { empty: {} }, false);
  openSheet(`<h3 style="color:${HEX[col]}">${E.cname(col)} · ${p.house} ${p.ai ? '(AI)' : ''}</h3>
    <p>${E.HOUSE_DESC[p.house]}${p.brk ? ' (non ancora usato)' : ''}</p>
    <div class="mini-board" style="grid-template-columns:repeat(${b.cols},${b.cw}px)">${b.html}</div>
    <p>${p.personal.length ? 'Carte personali: ' + p.personal.map(i => E.CARD_NAME[E.cardType(i)]).join(', ') : 'Nessuna carta personale.'}</p>
    <p>Guerriero: ${p.war ? 'forza ' + p.wStr + (p.rysh ? ', Ryshadium +3 difesa' : '') + ' · difesa ' + E.warriorDefense(col) : 'nessuno'}</p>
    ${scoreTable([col])}
    <div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}
function scoreTable(cols, winners) {
  return `<table class="score-table"><tr><th></th><th>Cuori</th><th>Guer.</th><th>Altop.</th><th>Avv.</th><th>Altro</th><th>PV</th></tr>` +
    cols.map(c => { const s = E.scoreOf(c); return `<tr class="${winners && winners.includes(c) ? 'win' : ''}"><td style="color:${HEX[c]}">${E.cname(c)}</td><td>${s.hearts}</td><td>${s.war}</td><td>${s.dom}</td><td>${s.cubes}</td><td>${s.rys + s.p4}</td><td><b>${s.total}</b></td></tr>`; }).join('') + '</table>';
}
function showLog() {
  openSheet(`<h3>Diario</h3><div class="log-full">${S().log.slice().reverse().map(l => `<div style="color:${HEX[l.c] || (l.c === 'bad' ? '#ff9e98' : l.c === 'gold' ? '#e8cf8a' : '')}">${l.m}</div>`).join('')}</div>
    <div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}
function showFinal() {
  const s = S(); if (s.phase !== 'END' || !s.result) return;
  const r = s.result; const cols = r.res.slice().sort((a, b) => b.s.total - a.s.total).map(x => x.col);
  const humanWon = r.winners.some(c => isHuman(c));
  openSheet(`<h3>${r.winners.length > 1 ? 'Pareggio!' : (humanWon ? 'Hai vinto!' : 'Vince ' + E.cname(r.winners[0]) + ' (' + s.P[r.winners[0]].house + ')')}</h3>
    <p>${r.best} punti vittoria${r.winners.length > 1 ? ' per ' + r.winners.map(E.cname).join(' e ') : ''}.</p>
    ${scoreTable(cols, r.winners)}
    <div class="sheet-btns"><button class="go" data-do="n">Nuova partita</button><button data-do="l">Diario della partita</button><button data-do="x">Guarda la mappa</button></div>`, { lock: true });
  sheetDo({ n: () => { closeSheet(); backToSetup(); }, l: showLog, x: closeSheet });
}
function showMenu() {
  openSheet(`<h3>Menu</h3><div class="sheet-btns">
    <button data-do="sc">Punteggi</button><button data-do="l">Diario</button><button data-do="r">Regole in breve</button>
    <button data-do="n">Nuova partita</button><button data-do="x">Chiudi</button></div>`);
  sheetDo({ sc: () => { const s = S(); openSheet(`<h3>Punteggi</h3>${scoreTable(s.play)}<div class="sheet-btns"><button data-do="x">Chiudi</button></div>`); sheetDo({ x: closeSheet }); },
    l: showLog, r: showRules, x: closeSheet,
    n: () => { openSheet(`<h3>Nuova partita?</h3><p>La partita in corso andrà persa.</p><div class="sheet-btns"><button class="go" data-do="y">Sì, ricomincia</button><button data-do="x">Annulla</button></div>`); sheetDo({ y: () => { drop(SAVE); closeSheet(); backToSetup(); }, x: closeSheet }); } });
}
function showRules() {
  openSheet(`<h3>Alethi in breve</h3><div class="rules">
  <p>Pianure Frantumate, 2–4 giocatori. Ogni Casata guida i suoi uomini fra gli altopiani: costruisce ponti, conquista spazi, uccide Parshendi e caccia gli Abissali per il loro Cuorgemma.</p>
  <h4>Il turno</h4><ul>
  <li><b>Sposta l'Animutante</b> su un'altra carta della tua plancia: ogni carta accanto (sopra, sotto, a destra, a sinistra) riceve 1 cristallo, +1 per ogni Fabrial.</li>
  <li><b>Attiva</b> le carte che vuoi, una alla volta: ogni attivazione spende <i>tutti</i> i cristalli della carta.</li>
  <li>A fine round arriva la <b>Fase Parshendi</b>: crollano i ponti accanto ai Parshendi e agli Abissali, i Parshendi assaltano gli avamposti deboli, gli Abissali attaccano i Guerrieri sui loro altopiani.</li></ul>
  <h4>Carte</h4><ul>${['ATK', 'CON', 'PON', 'COM', 'ATT', 'STR', 'RYS', 'FAB', 'P4', 'TRA'].map(t => `<li><b>${E.CARD_NAME[t]}</b>: ${E.CARD_DESC[t]}</li>`).join('')}</ul>
  <h4>Rete e combattimento</h4><p>Gli altopiani collegati da ponti formano una rete. Agisci solo dove hai avamposti o il Guerriero. Per vincere uno scontro serve forza <b>strettamente superiore</b>. Se non basti, puoi chiedere forza in prestito a chi ha pezzi nella rete: in cambio scegli tu dove va il suo Animutante (Spostamento Bonus).</p>
  <h4>Evocazione</h4><p>Ogni Parshendi ucciso va nel Cumulo dei morti. Si tira il dado: se esce meno del numero di morti, un Abissale emerge nel Nodo indicato dal secondo dado, fa crollare i ponti intorno e chi ha ucciso prende un Avvistamento (+1 PV).</p>
  <h4>Fine e punti</h4><p>Quando cade il terzo Abissale si completa il round e la partita finisce. Punti: 3 per Cuorgemma, 3 per il Guerriero vivo, gli spazi di ogni altopiano dove hai più avamposti, 1 per Avvistamento, Ryshadium e Ponte Quattro.</p>
  <h4>Casate</h4><ul>${E.HOUSES.map(h => `<li><b>${h}</b>: ${E.HOUSE_DESC[h]}</li>`).join('')}</ul>
  </div><div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}

renderSetup();
if (new URLSearchParams(location.search).get('resume') === '1' && load(SAVE)) $('resumeBtn').click();
})();
