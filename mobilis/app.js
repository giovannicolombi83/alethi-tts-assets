/* MOBILIS IN MOBILI — interfaccia per telefono */
(function () {
'use strict';
const E = window.MimEngine, AI = window.MimAI;
const $ = id => document.getElementById(id);
const S = () => E.getState();
const CH = E.CH, CH_IT = E.CH_IT;
const CHAMBER_POS = { INNOVATE: [0.3474, 0.2349], ATTACK: [0.6521, 0.2327], REVOLUTION: [0.7915, 0.7594], EXPLORE: [0.4994, 0.8097], NAVIGATE: [0.2036, 0.7586] };
const CHAMBER_R = 0.072;
const EQ_C = [0.4955, 0.4318], EQ_R = [0, 0.0804, 0.136, 0.192], EQ_EDGE = 0.2135;
const QANG = { NE: -45, SE: 45, SW: 135, NW: -135 };
const Q_IT = { NE: 'Nord-Est (Revenge)', SE: 'Sud-Est (Revolution)', SW: 'Sud-Ovest (Technology)', NW: 'Nord-Ovest (Voyage)' };
const FX_IT = { '+T': 'prendi un tesoro e mettilo nello Scrigno', '-T': 'consuma un tesoro dello Scrigno', '+B': 'aggiungi una lampadina in una camera a scelta',
  '+U': 'aggiungi un Uprising nella camera Attack', '+S': 'aggiungi un marinaio in una camera a scelta', '-S': 'togli un marinaio da una camera a scelta',
  '-W': 'consuma un relitto dell\'Abyssal Graveyard' };
const DIR_IT = { N: 'Nord (Egoismo)', S: 'Sud (Altruismo)', E: 'Est (Passione)', W: 'Ovest (Razionalità)', NE: 'Nord-Est', SE: 'Sud-Est', SW: 'Sud-Ovest', NW: 'Nord-Ovest' };
const SAVE = 'mim-save-v1', CFG = 'mim-cfg-v1';
const ui = { busy: false, sel: null, hl: null, anim: null, timer: null };

function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
function load(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function drop(k) { try { localStorage.removeItem(k); } catch (e) { } }
const portrait = c => c ? 'img/' + c + '.jpg' : 'img/nautcard.jpg';
const pname = p => p.char ? E.CHARS[p.char].name : 'Nemo';

// ------------------------------------------------ schermata iniziale
let cfg = load(CFG) || { mode: 'multi', seats: [{ char: 'ARONNAX', ai: false }, { char: 'NED', ai: true }] };
function seatsFor(mode) {
  if (mode === 'team') {
    const base = cfg.seats.length === 4 ? cfg.seats : [{ char: 'ARONNAX', ai: false }, { char: 'NED', ai: true }, { char: 'CONSEIL', ai: true }, { char: 'EGO', ai: true }];
    return base.slice(0, 4);
  }
  if (mode === 'multi' && cfg.seats.length > 3) return cfg.seats.slice(0, 3);
  return cfg.seats;
}
function renderSetup() {
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === cfg.mode));
  if (cfg.mode === 'solo') {
    $('seats').innerHTML = `<p class="solo-note">Sei Nemo, da solo contro la sua <b>Nemesis</b>: l'Ombra segue il Nautilus, blocca la carta appena lasciata e reclama la memoria su cui si trova ogni volta che reclami tu. Si vince solo nel <b>Maelstrom</b>, con più simboli Fate della Nemesis. Un Meltdown è la sconfitta.</p>`;
    $('addSeat').classList.add('hidden');
  } else {
    cfg.seats = seatsFor(cfg.mode);
    const used = cfg.seats.map(s => s.char);
    $('seats').innerHTML = cfg.seats.map((s, i) => `<div class="seat">
      <img src="${portrait(s.char)}" alt="">
      ${cfg.mode === 'team' ? `<span class="tm">Squadra ${i % 2 ? 'B' : 'A'}</span>` : ''}
      <select data-c="${i}">${Object.keys(E.CHARS).map(c => `<option value="${c}" ${c === s.char ? 'selected' : ''} ${c !== s.char && used.includes(c) ? 'disabled' : ''}>${E.CHARS[c].name}</option>`).join('')}</select>
      <button class="toggle ${s.ai ? 'ai' : 'me'}" data-t="${i}">${s.ai ? 'AI' : 'Tu'}</button>
      ${cfg.mode === 'multi' && cfg.seats.length > 2 ? `<button class="x" data-x="${i}" aria-label="Togli">✕</button>` : ''}</div>`).join('');
    $('addSeat').classList.toggle('hidden', cfg.mode !== 'multi' || cfg.seats.length >= 3);
  }
  $('resumeBtn').classList.toggle('hidden', !load(SAVE));
}
$('modeSeg').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; cfg.mode = b.dataset.m; if (cfg.mode === 'team') cfg.seats = seatsFor('team'); renderSetup(); };
$('seats').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.t !== undefined) { const s = cfg.seats[+t.dataset.t]; s.ai = !s.ai; renderSetup(); }
  if (t.dataset.x !== undefined) { cfg.seats.splice(+t.dataset.x, 1); renderSetup(); }
});
$('seats').addEventListener('change', e => { if (e.target.dataset.c !== undefined) { cfg.seats[+e.target.dataset.c].char = e.target.value; renderSetup(); } });
$('addSeat').onclick = () => { const c = Object.keys(E.CHARS).find(x => !cfg.seats.some(s => s.char === x)); cfg.seats.push({ char: c, ai: true }); renderSetup(); };
$('startBtn').onclick = () => {
  if (cfg.mode !== 'solo' && !cfg.seats.some(s => !s.ai)) { toast('Almeno un giocatore deve essere umano.', 'bad'); return; }
  store(CFG, cfg);
  E.newGame({ mode: cfg.mode, players: cfg.mode === 'solo' ? [] : cfg.seats.map(s => ({ char: s.char, ai: s.ai })) });
  startGame();
};
$('resumeBtn').onclick = () => { const s = load(SAVE); if (!s) return; E.setState(s); S().fx = []; startGame(); };
$('rulesBtn0').onclick = () => showRules();
$('menuBtn').onclick = () => showMenu();
function startGame() { $('setup').classList.add('hidden'); $('game').classList.remove('hidden'); window.scrollTo(0, 0); ui.busy = false; ui.sel = null; update(); }
function backToSetup() { clearTimeout(ui.timer); ui.busy = false; $('game').classList.add('hidden'); $('setup').classList.remove('hidden'); renderSetup(); }

// ------------------------------------------------ ciclo
const human = () => { const s = S(); return s.phase === 'PLAY' && !s.players[s.turn].ai; };
function update() {
  const s = S();
  if (s.phase === 'END') drop(SAVE); else store(SAVE, s);
  render(); playFx();
  if (s.phase === 'END') { setTimeout(showFinal, 1100); return; }
  if (!human() && !ui.busy) aiStep();
}
// applica un'azione con l'animazione del mancala
function perform(fn) {
  const before = {}; for (const c of CH) before[c] = S().ch[c].s;
  fn();
  const sow = S().fx.find(f => f.t === 'sow');
  ui.sel = null; closeSheet();
  if (sow && sow.path.length) animateSow(before, sow, () => { ui.busy = false; update(); });
  else { ui.busy = false; update(); }
}
function animateSow(before, sow, done) {
  ui.busy = true;
  const disp = { ...before }; disp[sow.from] = 0;
  ui.anim = { disp, src: sow.from, last: null };
  render();
  let i = 0;
  const step = () => {
    if (i >= sow.path.length) { ui.anim = null; done(); return; }
    const c = sow.path[i++]; disp[c]++; ui.anim.last = c;
    renderNaut(targets());
    ui.timer = setTimeout(step, 230);
  };
  ui.timer = setTimeout(step, 250);
}
function aiStep() {
  ui.busy = true; renderPrompt(targets());
  ui.timer = setTimeout(() => {
    const d = AI.decide();
    ui.hl = hlFor(d); render();
    ui.timer = setTimeout(() => {
      ui.hl = null;
      perform(() => { if (d.type === 'choose') E.choose(d.v); else E.act(d.a); });
    }, 700);
  }, 450);
}
function hlFor(d) {
  const s = S();
  if (d.type === 'choose') { if (typeof d.v === 'string' && CH.includes(d.v)) return { ch: d.v }; if (typeof d.v === 'string' && d.v.length === 2) return { q: d.v }; if (Array.isArray(d.v)) return { ship: d.v }; return null; }
  const a = d.a;
  if (a.t === 'NAV') return { cell: [a.r, a.c], ch: 'NAVIGATE' };
  if (a.t === 'RECLAIM') return { cell: [s.naut.r, s.naut.c], ch: E.card(E.cardAt(s.naut.r, s.naut.c)).type };
  if (a.t === 'ATTACK') return { ship: [a.route, a.s], ch: 'ATTACK' };
  if (a.t === 'REST') return { ch: a.ch };
  return null;
}

// ------------------------------------------------ effetti
function playFx() {
  const s = S(); const list = s.fx.splice(0); let d = 0;
  for (const f of list) {
    if (f.t === 'meltdown') setTimeout(() => toast('MELTDOWN! La mente di Nemo crolla.', 'bad'), d += 150);
    else if (f.t === 'sink') setTimeout(() => toast('Nave affondata: un relitto nell\'Abyssal Graveyard'), d += 150);
    else if (f.t === 'ship') setTimeout(() => toast('Una nave da guerra entra in rotta', 'bad'), d += 150);
    else if (f.t === 'maelstrom') setTimeout(() => toast('Un Maelstrom emerge in fondo al fiume!', 'big'), d += 150);
    else if (f.t === 'reclaim') setTimeout(() => toast('Memoria reclamata: «' + E.card(f.id).title + '»'), d += 100);
  }
}
function toast(html, cls) { const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.innerHTML = html; $('toasts').appendChild(t); setTimeout(() => t.remove(), 3100); }

// ------------------------------------------------ bersagli dell'umano
function targets() {
  const s = S(); const t = { cells: {}, ships: {}, ch: {}, q: {} };
  if (ui.busy || !human()) return t;
  const P = s.pending;
  if (P) {
    if (P.kind === 'BULB' || P.kind === 'ADD_SAILOR' || P.kind === 'LOSE_SAILOR') for (const c of P.options) t.ch[c] = () => E.choose(c);
    if (P.kind === 'QUADRANT') for (const q of P.options) t.q[q] = () => E.choose(q);
    if (P.kind === 'NEM_SINK') for (const o of P.options) t.ships[o.join(':')] = () => E.choose(o);
    return t;
  }
  if (ui.sel && ui.sel.kind === 'NAV') { for (const n of E.navTargets()) t.cells[n.r + ',' + n.c] = () => E.act({ t: 'NAV', r: n.r, c: n.c }); return t; }
  if (ui.sel && ui.sel.kind === 'ATTACK') { for (const [R, sp] of E.attackTargets()) t.ships[R + ':' + sp] = () => E.act({ t: 'ATTACK', route: R, s: sp }); return t; }
  for (const c of CH) if (s.ch[c].s > 0) t.ch[c] = 'menu';
  return t;
}

// ------------------------------------------------ disegno
function render() {
  const s = S(); if (!s) return;
  const T = targets();
  renderStatus(); renderPlayers(); renderPrompt(T); renderSea(T); renderNaut(T); renderEq(T);
}
function renderStatus() {
  const s = S(); const p = s.players[s.turn];
  let h = `<b>Round ${s.round}</b>`;
  if (s.phase === 'PLAY') h += `<span class="turnchip"><img src="${portrait(p.char)}" alt="">${pname(p)}</span><span class="pips">${'●'.repeat(Math.max(0, s.actions))}${'○'.repeat(3 - Math.max(0, s.actions))}</span>`;
  else h += ' · fine partita';
  $('status').innerHTML = h;
}
function condIcons(p) { return E.CHARS[p.char].conds.map(c => `<span class="${E.condMet(c) ? 'ok' : 'no'}">${c[0]}${c.slice(1, 3).toLowerCase()}</span>`).join(' ') + ` <span class="${E.inHalf(E.CHARS[p.char].half) ? 'ok' : 'no'}">Eq</span>`; }
function renderPlayers() {
  const s = S(); const t = E.fateType();
  const fateTxt = cards => `⌘${E.fateCount(cards, 'K')} Ⓐ${E.fateCount(cards, 'A')} · ${cards.length} carte`;
  if (s.mode === 'solo') {
    $('players').innerHTML = `<button class="pchip on" data-p="0"><img src="img/nautcard.jpg" alt=""><div><div class="n">Nemo</div><div class="m">${fateTxt(s.players[0].cards)}</div></div></button>
      <button class="pchip" data-p="nem"><img src="img/nemesis.jpg" alt=""><div><div class="n">Nemesis</div><div class="m">${fateTxt(s.nemLoot)}</div></div></button>`;
    return;
  }
  $('players').innerHTML = s.players.map(p => `<button class="pchip ${p.idx === s.turn && s.phase === 'PLAY' ? 'on' : ''} ${E.canWin(p) ? 'win' : ''}" data-p="${p.idx}">
    <img src="${portrait(p.char)}" alt=""><div style="min-width:0"><div class="n">${s.mode === 'team' ? (p.team ? 'B · ' : 'A · ') : ''}${pname(p)}${p.ai ? '' : ' (tu)'}</div>
    <div class="m">${condIcons(p)}</div><div class="m">${fateTxt(p.cards)}</div></div></button>`).join('');
}
$('players').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) showPlayer(b.dataset.p); });

function promptText() {
  const s = S(); const p = s.players[s.turn];
  if (s.phase === 'END') return 'Partita finita.';
  if (!human()) return pname(p) + ' sta giocando…';
  const P = s.pending;
  if (P) return {
    BULB: 'Tocca la camera del Nautilus dove mettere la <b>lampadina</b>.',
    ADD_SAILOR: 'Tocca la camera dove aggiungere un <b>marinaio</b>.',
    LOSE_SAILOR: 'Tocca la camera da cui togliere un <b>marinaio</b>.',
    QUADRANT: 'Il Mind token è al centro: scegli verso dove si sposta la mente di Nemo.',
    ROUTE: 'La carta era nel fiume centrale: scegli su quale rotta compare la nave.',
    NEM_SINK: 'La Nemesis affonda una nave: tocca quale.'
  }[P.kind];
  if (ui.sel && ui.sel.kind === 'NAV') return 'Navigate ' + E.power('NAVIGATE') + ': tocca la carta di destinazione (fino a ' + E.power('NAVIGATE') + ' passi, non in diagonale).';
  if (ui.sel && ui.sel.kind === 'ATTACK') return 'Attack ' + E.power('ATTACK') + ': tocca la nave da affondare (scudo ' + E.shield() + ').';
  return (s.mode === 'team' ? '' : '') + '<b>' + pname(p) + '</b>, azione ' + (4 - s.actions) + ' di 3: tocca il tasto di una camera del Nautilus (EXPLORE, ATTACK…).';
}
function renderPrompt(T) {
  const s = S(); const pr = $('prompt');
  pr.classList.toggle('thinking', ui.busy && s.phase === 'PLAY' || (!human() && s.phase === 'PLAY'));
  pr.classList.toggle('choice', !!(s.pending && human()));
  $('promptText').innerHTML = promptText();
  const b = [];
  if (!ui.busy && human()) {
    const P = s.pending;
    if (P && P.kind === 'ROUTE') for (const r of P.options) b.push([r === 'N' ? 'Rotta nord' : 'Rotta sud', () => E.choose(r)]);
    if (P && P.kind === 'QUADRANT') for (const q of P.options) b.push([Q_IT[q], () => E.choose(q)]);
    if (!P && ui.sel) b.push(['Annulla', null, '', true]);
    if (!P && !ui.sel && E.canDeclare()) b.push(['Dichiara vittoria', () => E.act({ t: 'DECLARE' }), 'go']);
  }
  $('promptBtns').innerHTML = b.map((x, i) => `<button data-b="${i}" class="${x[2] || ''}">${x[0]}</button>`).join('');
  $('promptBtns')._b = b;
  $('miniLog').innerHTML = s.log.slice(-3).reverse().map(l => `<div>${l.m}</div>`).join('');
}
$('promptBtns').addEventListener('click', e => {
  const el = e.target.closest('[data-b]'); if (!el) return; const x = $('promptBtns')._b[+el.dataset.b];
  if (x[3]) { ui.sel = null; render(); return; }
  if (!ui.busy) perform(x[1]);
});
$('miniLog').onclick = () => showLog();

// ---------- mare
function seaGeo() {
  const w = $('seaWrap').clientWidth - 12; const gx = 4;
  const cw = (w - 5 * gx) / 6, chh = cw * 1052 / 674, gy = cw * 0.42;
  return { w, gx, cw, ch: chh, gy, h: 3 * chh + 2 * gy + 8 };
}
const cx = (g, c) => c * (g.cw + g.gx), cy = (g, r) => r * (g.ch + g.gy);
function renderSea(T) {
  const s = S(); const g = seaGeo(); const sea = $('sea');
  sea.style.width = g.w + 'px'; sea.style.height = g.h + 'px';
  const hl = ui.hl || {}; let h = '';
  for (let r = 0; r < 3; r++) {
    const row = s.rows[r]; const ml = E.maelstromAt(r);
    for (let c = 0; c < 6; c++) {
      const x = cx(g, c), y = cy(g, r); const k = r + ',' + c; const tg = T.cells[k];
      const isHl = hl.cell && hl.cell[0] === r && hl.cell[1] === c;
      const cls = `mc ${tg ? 'tgt' : ''} ${isHl ? 'hl' : ''}`;
      const st = `left:${x}px;top:${y}px;width:${g.cw}px;height:${g.ch}px`;
      if (c < row.cards.length) {
        const id = row.cards[c];
        if (id === null) { h += `<div class="${cls} empty" data-cell="${k}" style="${st}"></div>`; continue; }
        const cd = E.card(id); const req = E.requirement(r, c);
        h += `<div class="${cls}" data-cell="${k}" style="${st}"><img class="art" src="img/m${id}.jpg" alt="${cd.title}">
          <span class="rq ${req > cd.req ? 'up' : ''}" style="background:var(--${cd.type})">${CH_IT[cd.type].slice(0, 3)} ${req}</span></div>`;
      } else if (c === ml) {
        h += `<div class="${cls}" data-cell="${k}" style="${st}"><img class="art" src="img/maelstrom.jpg" alt="Maelstrom"></div>`;
      } else if (c === 5 && row.stack.length) {
        h += `<div class="mc" style="${st}"><img class="art" src="img/back.jpg" alt="Mazzo"><span class="cnt">${row.stack.length}</span></div>`;
      }
    }
  }
  // navi
  for (const R of ['N', 'S']) for (let sp = 0; sp < 4; sp++) {
    const x = cx(g, sp) + g.cw + g.gx / 2, y = cy(g, R === 'N' ? 0 : 1) + g.ch + g.gy / 2;
    const key = R + ':' + sp; const tg = T.ships[key]; const isHl = hl.ship && hl.ship[0] === R && hl.ship[1] === sp;
    if (s.routes[R][sp]) h += `<img class="ship ${tg ? 'tgt' : ''} ${isHl ? 'hl' : ''}" data-ship="${key}" src="img/warship.png" style="left:${x}px;top:${y}px;width:${g.cw * 0.5}px" alt="Nave">`;
    else h += `<span class="ship slot" style="left:${x}px;top:${y}px"></span>`;
  }
  // Nautilus e Nemesis
  const n = s.naut;
  h += `<img class="tok" src="img/sub.png" style="left:${cx(g, n.c) - g.cw * 0.08}px;top:${cy(g, n.r) + g.ch * 0.62}px;width:${g.cw * 1.16}px;z-index:5" alt="Nautilus">`;
  if (s.nemesis && s.nemesis.c >= 0) h += `<span class="tok" style="left:${cx(g, s.nemesis.c) + g.cw * 0.28}px;top:${cy(g, s.nemesis.r) + g.ch * 0.3}px;width:${g.cw * 0.44}px;height:${g.cw * 0.44}px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#3a3a3a,#000);border:2px solid #a33;z-index:5"></span>`;
  sea.innerHTML = h; sea._T = T;
}
$('sea').addEventListener('click', e => {
  const T = $('sea')._T || {};
  const sh = e.target.closest('[data-ship]'); if (sh && T.ships[sh.dataset.ship]) { if (!ui.busy) perform(T.ships[sh.dataset.ship]); return; }
  const c = e.target.closest('[data-cell]'); if (!c) return;
  if (T.cells[c.dataset.cell]) { if (!ui.busy) perform(T.cells[c.dataset.cell]); return; }
  const [r, cc] = c.dataset.cell.split(',').map(Number); const id = E.cardAt(r, cc);
  if (id !== null && id !== undefined) cardSheet(id, r, cc);
  else if (E.isMaelstrom(r, cc)) infoMaelstrom();
});

// ---------- plancia del Nautilus
function renderNaut(T) {
  const s = S(); const wrap = $('nautWrap'); const W = wrap.clientWidth, H = wrap.clientHeight || W * 1158 / 1512;
  const disp = ui.anim ? ui.anim.disp : null; const hl = ui.hl || {};
  let h = '';
  for (const c of CH) {
    const [fx, fy] = CHAMBER_POS[c]; const d = CHAMBER_R * W * 2;
    const n = disp ? disp[c] : s.ch[c].s; const b = s.ch[c].b, u = s.ch[c].u;
    const tg = T.ch[c]; const isSrc = ui.anim && ui.anim.src === c;
    let cubes = '';
    for (let i = 0; i < n; i++) cubes += `<span class="cube ${ui.anim && ui.anim.last === c && i === n - 1 ? 'new' : ''}"></span>`;
    for (let i = 0; i < u; i++) cubes += '<span class="cube u"></span>';
    for (let i = 0; i < b; i++) cubes += '<img class="bulb" src="img/bulb.png" alt="">';
    h += `<div class="chamber ${tg && tg !== 'menu' ? 'tgt' : ''} ${isSrc ? 'src' : ''} ${hl.ch === c ? 'hl' : ''}" data-ch="${c}" style="left:${fx * 100}%;top:${fy * 100}%;width:${d}px;height:${d}px">${cubes}</div>`;
    const pw = E.power(c);
    const by = fy * H + CHAMBER_R * W * 0.98;
    h += `<button class="redis ${tg ? 'tgt' : ''} ${tg ? '' : 'off'}" data-ch="${c}" style="left:${fx * 100}%;top:${Math.min(by, H - 24)}px">${tg && tg !== 'menu' ? 'QUI' : c}<b>${pw}</b></button>`;
  }
  h += `<span class="stock" style="left:3%;top:4%"><img src="img/gem.png" alt="">${s.chest}</span>`;
  h += `<span class="stock" style="right:3%;top:30%"><img src="img/wreck.png" alt="">${s.wrecks}</span>`;
  $('naut').innerHTML = h; $('naut')._T = T;
  $('powerHint').textContent = 'scudo navi ' + E.shield() + ' · Uprising ' + E.uprising();
}
$('naut').addEventListener('click', e => {
  const el = e.target.closest('[data-ch]'); if (!el || ui.busy) return;
  const T = $('naut')._T || { ch: {} }; const c = el.dataset.ch; const tg = T.ch[c];
  if (!tg) { if (human() && !S().pending) toast('La camera ' + CH_IT[c] + ' è vuota.'); return; }
  if (tg === 'menu') chamberMenu(c); else perform(tg);
});
function chamberMenu(c) {
  const s = S(); const opts = []; const pw = E.power(c);
  const n = s.naut; const id = E.cardAt(n.r, n.c);
  if (c === 'NAVIGATE') {
    const nt = E.navTargets();
    opts.push([`Naviga: fino a ${pw} ${pw === 1 ? 'passo' : 'passi'}`, nt.length ? () => { ui.sel = { kind: 'NAV' }; closeSheet(); render(); $('seaWrap').scrollIntoView({ behavior: 'smooth', block: 'center' }); } : null, 'go']);
  }
  if (c === 'ATTACK') {
    const at = E.attackTargets();
    const why = !E.shipsNear(n.r, n.c).length ? 'Nessuna nave in diagonale rispetto al Nautilus.' : 'Serve forza superiore allo scudo (' + E.shield() + ').';
    opts.push([`Attacca una nave (forza ${pw}, scudo ${E.shield()})`, at.length ? (at.length === 1 ? () => perform(() => E.act({ t: 'ATTACK', route: at[0][0], s: at[0][1] })) : () => { ui.sel = { kind: 'ATTACK' }; closeSheet(); render(); $('seaWrap').scrollIntoView({ behavior: 'smooth', block: 'center' }); }) : null, 'go', at.length ? '' : why]);
  }
  let cardHtml = '';
  if (id !== null && id !== undefined && E.card(id).type === c) {
    const k = E.reclaimCheck();
    opts.push([`Reclama «${E.card(id).title}» (${pw} su ${E.requirement(n.r, n.c)})`, k.ok ? () => perform(() => E.act({ t: 'RECLAIM' })) : null, 'go', k.ok ? '' : k.why]);
    cardHtml = `<img src="img/m${id}.jpg" style="width:38%;float:right;margin-left:10px;border-radius:8px" alt="">`;
  }
  opts.push(['Riposa: ridistribuisci soltanto', () => perform(() => E.act({ t: 'REST', ch: c }))]);
  openSheet(`<h3>${CH_IT[c]} · potere ${pw}</h3>${cardHtml}
    <p>${s.ch[c].s} marinai${s.ch[c].b ? ', ' + s.ch[c].b + ' lampadine' : ''}${c === 'ATTACK' && s.ch[c].u ? ', ' + s.ch[c].u + ' Uprising' : ''}. Ridistribuendo, ogni marinaio va in una camera successiva, in senso orario.</p>
    <div class="sheet-btns" style="clear:both">${opts.map((o, i) => `<button data-do="${i}" class="${o[2] || ''}" ${o[1] ? '' : 'disabled'}>${o[0]}</button>${o[3] ? `<div class="reason">${o[3]}</div>` : ''}`).join('')}<button data-do="x">Annulla</button></div>`);
  const m = { x: closeSheet }; opts.forEach((o, i) => { if (o[1]) m[i] = () => { closeSheet(); o[1](); }; }); sheetDo(m);
}

// ---------- equilibrio
function mindXY(ring, q) {
  if (!ring) return EQ_C;
  const a = QANG[q] * Math.PI / 180; const r = EQ_R[ring];
  return [EQ_C[0] + r * Math.cos(a), EQ_C[1] + r * Math.sin(a)];
}
function renderEq(T) {
  const s = S(); let h = '';
  const [x, y] = mindXY(s.mind.ring, s.mind.q);
  h += `<img class="mind ${ui.hl && ui.hl.q ? '' : ''}" src="img/mind.png" style="left:${x * 100}%;top:${y * 100}%" alt="Mind token">`;
  h += `<span class="meltring ${s.mind.ring === 3 ? 'warn' : ''}" style="left:${EQ_C[0] * 100}%;top:${EQ_C[1] * 100}%;width:${EQ_EDGE * 200}%;aspect-ratio:1"></span>`;
  for (const q in T.q) { const [qx, qy] = mindXY(1, q); h += `<button class="qspot tgt" data-q="${q}" style="left:${qx * 100}%;top:${qy * 100}%"></button>`; }
  if (ui.hl && ui.hl.q) { const [qx, qy] = mindXY(1, ui.hl.q); h += `<span class="qspot hl" style="left:${qx * 100}%;top:${qy * 100}%"></span>`; }
  const tags = { VOYAGE: [0.19, 0.245, `${s.chest} > ${E.shipsAfloat()}`], REVENGE: [0.81, 0.245, `${s.wrecks} > ${E.totalBulbs()}`],
    TECHNOLOGY: [0.19, 0.925, `${E.totalBulbs()} > ${s.wrecks}`], REVOLUTION: [0.81, 0.925, `${E.uprising()} > ${E.shipsAfloat()}`] };
  for (const k in tags) { const [tx, ty, txt] = tags[k]; h += `<span class="condtag ${E.condMet(k) ? 'ok' : 'no'}" style="left:${tx * 100}%;top:${ty * 100}%;transform:translateX(-50%)">${txt} ${E.condMet(k) ? '✓' : ''}</span>`; }
  $('eq').innerHTML = h; $('eq')._T = T;
}
$('eq').addEventListener('click', e => { const b = e.target.closest('[data-q]'); const T = $('eq')._T; if (b && T && T.q[b.dataset.q] && !ui.busy) perform(T.q[b.dataset.q]); });
window.addEventListener('resize', () => { if (S() && !$('game').classList.contains('hidden')) render(); });

// ------------------------------------------------ fogli
function openSheet(html, lock) { $('sheetContent').innerHTML = html; $('sheet').classList.remove('hidden'); $('sheet').dataset.lock = lock ? '1' : ''; }
function closeSheet() { $('sheet').classList.add('hidden'); }
function sheetDo(m) { $('sheet')._do = m; }
$('sheet').addEventListener('click', e => {
  if (e.target.classList.contains('sheet-bg') && !$('sheet').dataset.lock) closeSheet();
  const b = e.target.closest('[data-do]'); if (b && !b.disabled && $('sheet')._do) { const f = $('sheet')._do[b.dataset.do]; if (f) f(); }
});
function fxText(f) { if (f.startsWith('I:')) { const d = f.slice(2); return 'squilibrio verso ' + DIR_IT[d] + (d.length === 1 ? ' (dal centro scegli il quadrante)' : ''); } return FX_IT[f]; }
function cardInfo(id) {
  const cd = E.card(id);
  return `<p>Requisito: <b>${CH_IT[cd.type]} ${cd.req}</b>${cd.fate ? ' · simbolo Fate ' + (cd.fate === 'K' ? '⌘ (Razionalità)' : 'Ⓐ (Passione)') : ''}</p>
    <ul class="fxlist">${cd.fx.map(f => `<li>${fxText(f)}</li>`).join('')}${cd.ship ? '<li>evoca una nave da guerra</li>' : ''}</ul>`;
}
function cardSheet(id, r, c) {
  const cd = E.card(id); const req = E.requirement(r, c);
  openSheet(`<div class="cardview"><img src="img/m${id}.jpg" alt=""><div><h3>${cd.title}</h3>${cardInfo(id)}
    ${req > cd.req ? `<p class="reason">Le navi vicine alzano il requisito a ${req}.</p>` : ''}</div></div><div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}
function infoMaelstrom() {
  openSheet(`<div class="cardview"><img src="img/maelstrom.jpg" alt=""><div><h3>Maelstrom</h3><p>Se il Nautilus entra nel Maelstrom la partita finisce. Con il Mind token nella metà <b>Ovest</b> vincono i simboli <b>⌘</b>; nella metà <b>Est</b> i simboli <b>Ⓐ</b>. Con il token al centro conta il totale di entrambi.</p></div></div><div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}
function showPlayer(k) {
  const s = S();
  if (k === 'nem') {
    openSheet(`<div class="cardview"><img src="img/nemesis.jpg" alt=""><div><h3>Nemesis</h3><p>Memorie della Nemesis: ${s.nemLoot.length}. Simboli ⌘ ${E.fateCount(s.nemLoot, 'K')}, Ⓐ ${E.fateCount(s.nemLoot, 'A')}.</p></div></div>
      <div class="thumbs">${s.nemLoot.map(i => `<img src="img/m${i}.jpg" alt="">`).join('')}</div><div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
    sheetDo({ x: closeSheet }); return;
  }
  const p = s.players[+k];
  const conds = p.char ? E.CHARS[p.char].conds.map(c => `<li class="${E.condMet(c) ? 'ok' : ''}">${E.COND_IT[c]} ${E.condMet(c) ? '✓' : '✗'}</li>`).join('') +
    `<li class="${E.inHalf(E.CHARS[p.char].half) ? 'ok' : ''}">Equilibrio: Mind token nella metà ${DIR_IT[E.CHARS[p.char].half]} ${E.inHalf(E.CHARS[p.char].half) ? '✓' : '✗'}</li>` : '';
  openSheet(`<div class="cardview"><img src="${portrait(p.char)}" alt=""><div><h3>${pname(p)}${p.ai ? ' (AI)' : ''}</h3>
    ${p.char ? `<p>Per dichiarare vittoria servono tutte e tre:</p><ul class="fxlist">${conds}</ul>` : ''}
    <p>Memorie: ${p.cards.length} · ⌘ ${E.fateCount(p.cards, 'K')} · Ⓐ ${E.fateCount(p.cards, 'A')}</p></div></div>
    <div class="thumbs">${p.cards.map(i => `<img src="img/m${i}.jpg" data-cid="${i}" alt="">`).join('')}</div>
    <div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}
function showLog() {
  openSheet(`<h3>Diario di bordo</h3><div class="log-full">${S().log.slice().reverse().map(l => `<div>${l.m}</div>`).join('')}</div><div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}
function showFinal() {
  const s = S(); const r = s.result; if (s.phase !== 'END' || !r) return;
  let title = '', body = '';
  const T = r.type === 'K' ? '⌘' : r.type === 'A' ? 'Ⓐ' : '⌘ + Ⓐ';
  if (r.solo) {
    title = r.why === 'Meltdown' ? 'Meltdown: Nemo perde la ragione' : r.win === null ? 'Pareggio nel Maelstrom' : r.win ? 'Nemo domina il suo passato!' : 'Vince la Nemesis';
    if (r.maelstrom) body = `<p>Simboli ${T}: Nemo ${r.me}, Nemesis ${r.nem}.</p>`;
  } else {
    const names = r.winners.map(i => pname(s.players[i]));
    const me = r.winners.some(i => !s.players[i].ai);
    title = (me ? 'Vittoria! ' : 'Vince ') + names.join(' e ');
    if (r.declare) body = `<p>${pname(s.players[r.by])} ha dichiarato la vittoria: condizioni del Personaggio ed Equilibrio raggiunti.</p>`;
    else body = `<p>Il Maelstrom ha inghiottito il Nautilus. Contano i simboli <b>${T}</b>.</p><table class="tbl"><tr><th></th><th>${T}</th><th>Carte</th></tr>${r.table.map(t => `<tr class="${r.winners.includes(t.members[0]) ? 'win' : ''}"><td>${t.members.map(i => pname(s.players[i])).join(' + ')}</td><td>${t.fate}</td><td>${t.n}</td></tr>`).join('')}</table>`;
  }
  openSheet(`<h3>${title}</h3>${body}<div class="sheet-btns"><button class="go" data-do="n">Nuova partita</button><button data-do="l">Diario di bordo</button><button data-do="x">Guarda il tavolo</button></div>`, true);
  sheetDo({ n: () => { closeSheet(); backToSetup(); }, l: showLog, x: closeSheet });
}
function showMenu() {
  openSheet(`<h3>Menu</h3><div class="sheet-btns"><button data-do="aid">Promemoria icone</button><button data-do="l">Diario di bordo</button><button data-do="r">Regole in breve</button><button data-do="n">Nuova partita</button><button data-do="x">Chiudi</button></div>`);
  sheetDo({ aid: () => { openSheet(`<img src="img/aid.jpg" style="width:100%;border-radius:10px" alt="Promemoria"><div class="sheet-btns"><button data-do="x">Chiudi</button></div>`); sheetDo({ x: closeSheet }); },
    l: showLog, r: showRules, x: closeSheet,
    n: () => { openSheet(`<h3>Nuova partita?</h3><p>La partita in corso andrà persa.</p><div class="sheet-btns"><button class="go" data-do="y">Sì, ricomincia</button><button data-do="x">Annulla</button></div>`); sheetDo({ y: () => { drop(SAVE); closeSheet(); backToSetup(); }, x: closeSheet }); } });
}
function showRules() {
  openSheet(`<h3>Mobilis in Mobili in breve</h3><div class="rules">
  <p>Nemo è perso nel Maelstrom. Ogni giocatore è una voce della sua mente e guida lo stesso Nautilus per prendere il sopravvento.</p>
  <h4>Il turno: 3 azioni</h4><ul>
  <li><b>Navigate</b>: ridistribuisci la camera Navigate e muovi il Nautilus di tanti passi quanto il suo potere, mai in diagonale.</li>
  <li><b>Reclama una memoria</b>: il Nautilus deve essere sulla carta. Ridistribuisci la camera del suo tipo: il potere deve arrivare al requisito (+1 per ogni nave in diagonale). Applica gli effetti da sinistra a destra.</li>
  <li><b>Attack</b>: ridistribuisci la camera Attack e affonda una nave in diagonale al Nautilus. Serve forza maggiore dello scudo (= relitti nell'Abyssal Graveyard). Ogni affondamento sposta la mente verso la Vendetta.</li>
  <li><b>Riposa</b>: ridistribuisci una camera senza altro effetto.</li>
  <li><b>Dichiara vittoria</b>, se hai le due condizioni del Personaggio e il Mind token nella tua metà.</li></ul>
  <h4>Mancala</h4><p>Il potere di una camera è il numero di marinai, più le lampadine (e gli Uprising in Attack) se c'è almeno un marinaio. Ridistribuire porta i marinai uno per camera, in senso orario: Innovate → Attack → Revolution → Explore → Navigate.</p>
  <h4>Squilibrio</h4><p>Nel quadrante indicato il token va sull'anello esterno, in quello opposto torna verso il centro, altrimenti gira sull'anello. Oltre il bordo c'è il Meltdown: chi è di turno scarta tutte le memorie e il token torna al centro.</p>
  <h4>Navi e fiumi</h4><p>Le navi entrano dalla destra delle rotte (al massimo 4 per rotta). Le carte reclamate si ricompattano verso sinistra; quando un mazzo finisce emerge il Maelstrom.</p>
  <h4>Maelstrom</h4><p>Chi ci porta il Nautilus chiude la partita: con la mente a Ovest vincono i simboli ⌘, a Est i simboli Ⓐ. In parità, più memorie.</p>
  <h4>4 giocatori</h4><p>Due squadre da due: una squadra vince se uno dei due raggiunge la propria condizione; nel Maelstrom si sommano le carte.</p>
  </div><div class="sheet-btns"><button data-do="x">Chiudi</button></div>`);
  sheetDo({ x: closeSheet });
}

renderSetup();
if (new URLSearchParams(location.search).get('resume') === '1' && load(SAVE)) $('resumeBtn').click();
})();
