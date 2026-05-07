/* ============================================================
   Chess — Pass-and-Play PWA Prototype  v0.2.0
   ============================================================
   Single-player local game where one human plays both sides.
   Adds: main menu, configurable rules, time control, board size,
   turn order, preset save/load (localStorage).
   Engine is parameterized by board width/height so 6×6 mini and
   8×8 standard share one implementation.
   Indexing: 0..W*H-1, idx 0 = top-left, file = idx % W,
   row = floor(idx / W) (row 0 = top rank).
   ============================================================ */

'use strict';

/* ── No service worker ───────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister());
  });
}
if ('caches' in window) {
  caches.keys().then(names => names.forEach(n => caches.delete(n)));
}

/* ── DOM ─────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const screens = {
  title:     $('screen-title'),
  online:    $('screen-online'),
  hostWait:  $('screen-host-wait'),
  join:      $('screen-join'),
  menu:      $('screen-menu'),
  customize: $('screen-customize'),
  game:      $('screen-game'),
};

// title controls
const btnSinglePlayer = $('btnSinglePlayer');
const btnOnline       = $('btnOnline');

// online controls
const btnOnlineBack   = $('btnOnlineBack');
const btnHostLobby    = $('btnHostLobby');
const btnJoinLobby    = $('btnJoinLobby');
const onlineStatus    = $('onlineStatus');
const btnHostCancel   = $('btnHostCancel');
const lobbyCodeEl     = $('lobbyCode');
const hostStatus      = $('hostStatus');
const btnJoinBack     = $('btnJoinBack');
const joinCodeEl      = $('joinCode');
const btnJoinConnect  = $('btnJoinConnect');
const joinStatus      = $('joinStatus');

// menu controls
const btnBackToTitle  = $('btnBackToTitle');
const presetSelect    = $('presetSelect');
const btnSavePreset    = $('btnSavePreset');
const btnDeletePreset  = $('btnDeletePreset');
const btnDefaultPreset = $('btnDefaultPreset');
const timeMode        = $('timeMode');
const timeFields      = $('timeFields');
const timeMinutes     = $('timeMinutes');
const timeIncrement   = $('timeIncrement');
const stalemateRule   = $('stalemateRule');
const fiftyMoveRule   = $('fiftyMoveRule');
const useCustomPieces = $('useCustomPieces');
const btnStartGame    = $('btnStartGame');

// customize controls
const btnCustomizeBack      = $('btnCustomizeBack');
const customPresetSelect    = $('customPresetSelect');
const btnSaveCustomPreset    = $('btnSaveCustomPreset');
const btnDeleteCustomPreset  = $('btnDeleteCustomPreset');
const btnDefaultCustomPreset = $('btnDefaultCustomPreset');
const pieceList             = $('pieceList');
const btnStartCustomGame    = $('btnStartCustomGame');

// game controls
const boardEl       = $('board');
const tagTop        = $('tagTop');
const tagBottom     = $('tagBottom');
const clockTop      = $('clockTop');
const clockBottom   = $('clockBottom');
const captureTop    = $('captureTop');
const captureBottom = $('captureBottom');
const gameStatus    = $('gameStatus');
const btnRestart    = $('btnRestart');  // doubles as Undo / Restart depending on game state
const btnFlip       = $('btnFlip');
const btnMenu       = $('btnMenu');
const historyList   = $('historyList');
const promoModal    = $('promoModal');

/* ── Constants ───────────────────────────────────────────────── */
const PIECE_CHAR  = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };
const PIECE_NAMES = { k:'King', q:'Queen', r:'Rook', b:'Bishop', n:'Knight', p:'Pawn' };
const PIECE_TYPES = ['k', 'q', 'r', 'b', 'n', 'p'];
const COLOR_NAME  = { w: 'White', b: 'Black' };
const VALUE       = { p:1, n:3, b:3, r:5, q:9, k:0 };

const PRESETS_KEY        = 'chess_presets_v1';
const LAST_CONFIG_KEY    = 'chess_last_config_v1';
const CUSTOM_PRESETS_KEY = 'chess_piece_presets_v1';
const LAST_CUSTOM_KEY    = 'chess_last_custom_v1';

const ID_PREFIX     = 'chess-mp-v1-';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN      = 6;

const DEFAULT_CONFIG = {
  timeControl: { mode: 'none', minutes: 5, increment: 0 },
  rules:       { stalemate: 'draw', fiftyMoveRule: true },
  size:        8,
  firstMove:   'w',
  useCustomPieces: false,
};

const MOVEMENT_PATTERNS = {
  king:       { type: 'leap',  offsets: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] },
  knight:     { type: 'leap',  offsets: [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]] },
  rook:       { type: 'slide', dirs:    [[1,0],[-1,0],[0,1],[0,-1]] },
  bishop:     { type: 'slide', dirs:    [[1,1],[1,-1],[-1,1],[-1,-1]] },
  queen:      { type: 'slide', dirs:    [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] },
  camel:      { type: 'leap',  offsets: [[1,3],[3,1],[3,-1],[1,-3],[-1,-3],[-3,-1],[-3,1],[-1,3]] },
  archbishop: { type: 'compound', parts: ['knight', 'bishop'] },
  chancellor: { type: 'compound', parts: ['knight', 'rook'] },
};

const MOVEMENT_OPTIONS = [
  { value: 'default',    label: 'Default (piece-standard)' },
  { value: 'king',       label: 'King — one step any direction' },
  { value: 'knight',     label: 'Knight — L-shape jump' },
  { value: 'rook',       label: 'Rook — orthogonal slide' },
  { value: 'bishop',     label: 'Bishop — diagonal slide' },
  { value: 'queen',      label: 'Queen — any-direction slide' },
  { value: 'camel',      label: 'Camel — 3-1 leap' },
  { value: 'archbishop', label: 'Archbishop — knight + bishop' },
  { value: 'chancellor', label: 'Chancellor — knight + rook' },
];

function blankCustom() {
  const pieces = {};
  for (const t of PIECE_TYPES) {
    pieces[t] = {
      wImg: '', bImg: '',
      moveSound: '', killSound: '', dieSound: '',
      movement: 'default',
    };
  }
  return { pieces };
}

/* ── Game state ──────────────────────────────────────────────── */
let state              = null;   // active game state, or null when in menu
let currentConfig      = null;   // match config used to create `state`
let currentCustom      = null;   // custom-piece config bound to `state`
let pendingMatchConfig = null;   // match config in flight while user customizes
let undoStack          = [];
let selected           = null;
let legalForSelected   = [];
let lastMove           = null;
let flipped            = false;
let pendingPromo       = null;

// Online state
let mode    = 'single';          // 'single' | 'host' | 'guest'
let peer    = null;
let conn    = null;
let myColor = null;              // 'w' | 'b' | null  (online only)

// Vote state for the dual-purpose action button (Undo while playing, Restart after end)
let pendingVote = { kind: null, mine: false, theirs: false };

// Clock UI state
let clockStartedAt = null;       // ms timestamp when active player's clock began
let clockTickHandle = null;

/* ── Coord helpers (depend on board size) ────────────────────── */
function fileOf(st, i)    { return i % st.width; }
function rankOf(st, i)    { return Math.floor(i / st.width); }
function inBounds(st, f, r) { return f >= 0 && f < st.width && r >= 0 && r < st.height; }
function FR(st, f, r)     { return r * st.width + f; }
function fileChar(st, i)  { return 'abcdefgh'[fileOf(st, i)]; }
function rankChar(st, i)  { return (st.height - rankOf(st, i)).toString(); }
function squareName(st, i){ return fileChar(st, i) + rankChar(st, i); }

/* ── Initial position ────────────────────────────────────────── */
function freshGame(cfg, customCfg) {
  const W = cfg.size, H = cfg.size;
  const back = W === 8
    ? ['r','n','b','q','k','b','n','r']
    : ['r','n','q','k','n','r']; // 6×6 mini (no bishops)

  const board = Array(W * H).fill(null);
  for (let f = 0; f < W; f++) {
    board[f]                 = { type: back[f], color: 'b' };
    board[W + f]             = { type: 'p',     color: 'b' };
    board[(H - 2) * W + f]   = { type: 'p',     color: 'w' };
    board[(H - 1) * W + f]   = { type: back[f], color: 'w' };
  }

  const castlingEnabled = (W === 8);
  const tcMode  = cfg.timeControl.mode;
  const startMs = (cfg.timeControl.minutes || 5) * 60 * 1000;

  return {
    width: W, height: H,
    backRank: back,
    kingHomeFile: back.indexOf('k'),
    castlingEnabled,
    doublePawnPush: (H === 8),
    board,
    turn: cfg.firstMove,
    castling: castlingEnabled
      ? { wk: true, wq: true, bk: true, bq: true }
      : { wk: false, wq: false, bk: false, bq: false },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    moves: [],
    captured: { w: [], b: [] },
    status: 'active',
    result: null,
    rules:       { ...cfg.rules },
    timeControl: { ...cfg.timeControl },
    clocks: tcMode === 'side' ? { w: startMs, b: startMs } : null,
    custom: customCfg ? JSON.parse(JSON.stringify(customCfg)) : null,
  };
}

function cloneState(s) {
  return {
    width: s.width, height: s.height,
    backRank: s.backRank,
    kingHomeFile: s.kingHomeFile,
    castlingEnabled: s.castlingEnabled,
    doublePawnPush: s.doublePawnPush,
    board: s.board.map(p => p ? { ...p } : null),
    turn: s.turn,
    castling:  { ...s.castling },
    enPassant: s.enPassant,
    halfmove:  s.halfmove,
    fullmove:  s.fullmove,
    moves:     s.moves.slice(),
    captured:  { w: s.captured.w.slice(), b: s.captured.b.slice() },
    status:    s.status,
    result:    s.result,
    rules:     { ...s.rules },
    timeControl: { ...s.timeControl },
    clocks: s.clocks ? { ...s.clocks } : null,
    custom: s.custom,  // immutable during play, share by reference
  };
}

/* ── Movement-override helpers ───────────────────────────────── */
function getMovementOverride(st, type) {
  const m = st.custom && st.custom.pieces && st.custom.pieces[type] && st.custom.pieces[type].movement;
  if (!m || m === 'default') return null;
  return MOVEMENT_PATTERNS[m] || null;
}

function movesFromPattern(st, idx, pattern) {
  const moves = [];
  const piece = st.board[idx];
  const W = st.width;
  const f = idx % W, r = Math.floor(idx / W);
  const enemy = piece.color === 'w' ? 'b' : 'w';

  if (pattern.type === 'leap') {
    for (const [df, dr] of pattern.offsets) {
      const tf = f + df, tr = r + dr;
      if (!inBounds(st, tf, tr)) continue;
      const t = FR(st, tf, tr);
      const tgt = st.board[t];
      if (!tgt) moves.push({ from: idx, to: t });
      else if (tgt.color === enemy) moves.push({ from: idx, to: t, capture: true });
    }
  } else if (pattern.type === 'slide') {
    for (const [df, dr] of pattern.dirs) {
      let tf = f + df, tr = r + dr;
      while (inBounds(st, tf, tr)) {
        const t = FR(st, tf, tr);
        const tgt = st.board[t];
        if (!tgt) {
          moves.push({ from: idx, to: t });
        } else {
          if (tgt.color === enemy) moves.push({ from: idx, to: t, capture: true });
          break;
        }
        tf += df; tr += dr;
      }
    }
  } else if (pattern.type === 'compound') {
    const seen = new Set();
    for (const part of pattern.parts) {
      for (const m of movesFromPattern(st, idx, MOVEMENT_PATTERNS[part])) {
        const key = m.to + (m.capture ? 'c' : '');
        if (!seen.has(key)) { seen.add(key); moves.push(m); }
      }
    }
  }
  return moves;
}

function patternReaches(st, fromIdx, targetIdx, pattern) {
  const W = st.width;
  const f = fromIdx % W, r = Math.floor(fromIdx / W);
  const tf = targetIdx % W, tr = Math.floor(targetIdx / W);
  const dx = tf - f, dy = tr - r;

  if (pattern.type === 'leap') {
    return pattern.offsets.some(([df, dr]) => df === dx && dr === dy);
  }
  if (pattern.type === 'slide') {
    for (const [df, dr] of pattern.dirs) {
      let nf = f + df, nr = r + dr;
      while (inBounds(st, nf, nr)) {
        if (nf === tf && nr === tr) return true;
        if (st.board[FR(st, nf, nr)]) break;
        nf += df; nr += dr;
      }
    }
    return false;
  }
  if (pattern.type === 'compound') {
    return pattern.parts.some(part => patternReaches(st, fromIdx, targetIdx, MOVEMENT_PATTERNS[part]));
  }
  return false;
}

/* ── Pseudo-legal move generation ────────────────────────────── */
function pseudoMoves(st, idx) {
  const piece = st.board[idx];
  if (!piece) return [];

  const override = getMovementOverride(st, piece.type);
  if (override) return movesFromPattern(st, idx, override);

  const moves = [];
  const W = st.width, H = st.height;
  const f = idx % W, r = Math.floor(idx / W);
  const enemy = piece.color === 'w' ? 'b' : 'w';

  const slide = (df, dr) => {
    let tf = f + df, tr = r + dr;
    while (inBounds(st, tf, tr)) {
      const t = FR(st, tf, tr);
      const tgt = st.board[t];
      if (!tgt) {
        moves.push({ from: idx, to: t });
      } else {
        if (tgt.color === enemy) moves.push({ from: idx, to: t, capture: true });
        break;
      }
      tf += df; tr += dr;
    }
  };
  const step = (df, dr) => {
    const tf = f + df, tr = r + dr;
    if (!inBounds(st, tf, tr)) return;
    const t = FR(st, tf, tr);
    const tgt = st.board[t];
    if (!tgt) moves.push({ from: idx, to: t });
    else if (tgt.color === enemy) moves.push({ from: idx, to: t, capture: true });
  };

  switch (piece.type) {
    case 'p': {
      const dir      = piece.color === 'w' ? -1 : 1;
      const startRow = piece.color === 'w' ? H - 2 : 1;
      const promoRow = piece.color === 'w' ? 0 : H - 1;
      const oneR = r + dir;

      if (inBounds(st, f, oneR) && !st.board[FR(st, f, oneR)]) {
        if (oneR === promoRow) {
          for (const promo of ['q','r','b','n']) moves.push({ from: idx, to: FR(st, f, oneR), promo });
        } else {
          moves.push({ from: idx, to: FR(st, f, oneR) });
          if (st.doublePawnPush && r === startRow && !st.board[FR(st, f, r + 2*dir)]) {
            moves.push({ from: idx, to: FR(st, f, r + 2*dir), double: true });
          }
        }
      }
      for (const df of [-1, 1]) {
        const tf = f + df, tr = r + dir;
        if (!inBounds(st, tf, tr)) continue;
        const t = FR(st, tf, tr);
        const tgt = st.board[t];
        if (tgt && tgt.color === enemy) {
          if (tr === promoRow) {
            for (const promo of ['q','r','b','n']) moves.push({ from: idx, to: t, capture: true, promo });
          } else {
            moves.push({ from: idx, to: t, capture: true });
          }
        } else if (st.enPassant === t) {
          moves.push({ from: idx, to: t, capture: true, enPassant: true });
        }
      }
      break;
    }
    case 'n':
      for (const [df, dr] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) step(df, dr);
      break;
    case 'b':
      slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1);
      break;
    case 'r':
      slide(1,0); slide(-1,0); slide(0,1); slide(0,-1);
      break;
    case 'q':
      slide(1,0); slide(-1,0); slide(0,1); slide(0,-1);
      slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1);
      break;
    case 'k': {
      for (const df of [-1,0,1]) for (const dr of [-1,0,1]) {
        if (df === 0 && dr === 0) continue;
        step(df, dr);
      }
      // Castling — only enabled on 8×8 standard
      if (st.castlingEnabled) {
        const homeRow = piece.color === 'w' ? H - 1 : 0;
        if (r === homeRow && f === st.kingHomeFile) {
          const c = st.castling;
          const kSide = piece.color === 'w' ? c.wk : c.bk;
          const qSide = piece.color === 'w' ? c.wq : c.bq;
          const rookK = st.board[FR(st, W - 1, homeRow)];
          const rookQ = st.board[FR(st, 0, homeRow)];
          if (kSide && rookK && rookK.type === 'r' && rookK.color === piece.color &&
              !st.board[FR(st, 5, homeRow)] && !st.board[FR(st, 6, homeRow)]) {
            moves.push({ from: idx, to: FR(st, 6, homeRow), castle: 'k' });
          }
          if (qSide && rookQ && rookQ.type === 'r' && rookQ.color === piece.color &&
              !st.board[FR(st, 1, homeRow)] && !st.board[FR(st, 2, homeRow)] && !st.board[FR(st, 3, homeRow)]) {
            moves.push({ from: idx, to: FR(st, 2, homeRow), castle: 'q' });
          }
        }
      }
      break;
    }
  }
  return moves;
}

/* ── Square-attack detection ─────────────────────────────────── */
function isAttacked(st, idx, byColor) {
  const total = st.width * st.height;
  for (let i = 0; i < total; i++) {
    const p = st.board[i];
    if (!p || p.color !== byColor) continue;
    const override = getMovementOverride(st, p.type);
    if (override) {
      if (patternReaches(st, i, idx, override)) return true;
    } else if (defaultPieceAttacks(st, i, idx)) {
      return true;
    }
  }
  return false;
}

function defaultPieceAttacks(st, fromIdx, targetIdx) {
  const piece = st.board[fromIdx];
  const W = st.width;
  const f = fromIdx % W, r = Math.floor(fromIdx / W);
  const tf = targetIdx % W, tr = Math.floor(targetIdx / W);
  const dx = tf - f, dy = tr - r;
  const adx = Math.abs(dx), ady = Math.abs(dy);

  switch (piece.type) {
    case 'p': {
      const dir = piece.color === 'w' ? -1 : 1;
      return adx === 1 && dy === dir;
    }
    case 'n': return (adx === 1 && ady === 2) || (adx === 2 && ady === 1);
    case 'k': return adx <= 1 && ady <= 1 && (adx + ady > 0);
    case 'r': {
      if (!(adx === 0 || ady === 0) || adx + ady === 0) return false;
      return clearLine(st, f, r, tf, tr);
    }
    case 'b': {
      if (adx !== ady || adx === 0) return false;
      return clearLine(st, f, r, tf, tr);
    }
    case 'q': {
      if (adx === 0 && ady === 0) return false;
      if (!(adx === 0 || ady === 0 || adx === ady)) return false;
      return clearLine(st, f, r, tf, tr);
    }
  }
  return false;
}

function clearLine(st, fromF, fromR, toF, toR) {
  const dx = Math.sign(toF - fromF), dy = Math.sign(toR - fromR);
  let f = fromF + dx, r = fromR + dy;
  while (f !== toF || r !== toR) {
    if (st.board[FR(st, f, r)]) return false;
    f += dx; r += dy;
  }
  return true;
}

function findKing(st, color) {
  const total = st.width * st.height;
  for (let i = 0; i < total; i++) {
    const p = st.board[i];
    if (p && p.type === 'k' && p.color === color) return i;
  }
  return -1;
}

/* ── Apply a move (mutates state) ────────────────────────────── */
function applyMoveTo(st, mv) {
  const piece = st.board[mv.from];
  const me = piece.color;
  const W = st.width, H = st.height;

  let captured = st.board[mv.to];
  if (mv.enPassant) {
    const epRow = me === 'w' ? rankOf(st, mv.to) + 1 : rankOf(st, mv.to) - 1;
    const epIdx = epRow * W + fileOf(st, mv.to);
    captured = st.board[epIdx];
    st.board[epIdx] = null;
  }

  st.board[mv.to]   = piece;
  st.board[mv.from] = null;

  if (mv.castle) {
    const homeRow = me === 'w' ? H - 1 : 0;
    if (mv.castle === 'k') {
      st.board[FR(st, 5, homeRow)]    = st.board[FR(st, W - 1, homeRow)];
      st.board[FR(st, W - 1, homeRow)] = null;
    } else {
      st.board[FR(st, 3, homeRow)] = st.board[FR(st, 0, homeRow)];
      st.board[FR(st, 0, homeRow)] = null;
    }
  }

  if (mv.promo) {
    st.board[mv.to] = { type: mv.promo, color: me };
  }

  if (captured) st.captured[me].push(captured);

  if (st.castlingEnabled) {
    if (piece.type === 'k') {
      if (me === 'w') { st.castling.wk = false; st.castling.wq = false; }
      else            { st.castling.bk = false; st.castling.bq = false; }
    }
    const wKR = FR(st, W - 1, H - 1);
    const wQR = FR(st, 0,     H - 1);
    const bKR = FR(st, W - 1, 0);
    const bQR = FR(st, 0,     0);
    if (mv.from === wKR || mv.to === wKR) st.castling.wk = false;
    if (mv.from === wQR || mv.to === wQR) st.castling.wq = false;
    if (mv.from === bKR || mv.to === bKR) st.castling.bk = false;
    if (mv.from === bQR || mv.to === bQR) st.castling.bq = false;
  }

  st.enPassant = null;
  if (piece.type === 'p' && mv.double) {
    st.enPassant = (mv.from + mv.to) >> 1;
  }

  if (piece.type === 'p' || captured) st.halfmove = 0;
  else st.halfmove++;
  if (me === 'b') st.fullmove++;

  st.turn = me === 'w' ? 'b' : 'w';
}

/* ── Legal-move filter ───────────────────────────────────────── */
function legalMoves(st, idx) {
  const piece = st.board[idx];
  if (!piece || piece.color !== st.turn) return [];
  const enemy = piece.color === 'w' ? 'b' : 'w';
  const result = [];
  for (const mv of pseudoMoves(st, idx)) {
    if (mv.castle) {
      const homeRow = piece.color === 'w' ? st.height - 1 : 0;
      const through = mv.castle === 'k' ? FR(st, 5, homeRow) : FR(st, 3, homeRow);
      if (isAttacked(st, mv.from, enemy)) continue;
      if (isAttacked(st, through, enemy)) continue;
    }
    const test = cloneState(st);
    applyMoveTo(test, mv);
    const k = findKing(test, piece.color);
    if (k >= 0 && !isAttacked(test, k, enemy)) result.push(mv);
  }
  return result;
}

function allLegalMoves(st) {
  const out = [];
  const total = st.width * st.height;
  for (let i = 0; i < total; i++) {
    const p = st.board[i];
    if (p && p.color === st.turn) out.push(...legalMoves(st, i));
  }
  return out;
}

/* ── Status (with configurable rules) ────────────────────────── */
function refreshStatus(st) {
  const enemy = st.turn === 'w' ? 'b' : 'w';
  const inCheck = isAttacked(st, findKing(st, st.turn), enemy);
  const moves = allLegalMoves(st);

  if (moves.length === 0) {
    if (inCheck) {
      st.status = 'checkmate';
      st.result = enemy;                        // mating side wins
    } else {
      // Stalemate — apply user-selected rule
      st.status = 'stalemate';
      const rule = st.rules.stalemate;
      if (rule === 'win')      st.result = enemy;     // stalemating side wins
      else if (rule === 'loss') st.result = st.turn;  // stalemating side loses
      else                      st.result = 'draw';
    }
    return;
  }

  if (st.rules.fiftyMoveRule && st.halfmove >= 100) {
    st.status = 'draw';
    st.result = 'draw';
    return;
  }

  st.status = inCheck ? 'check' : 'active';
  st.result = null;
}

/* ── Standard Algebraic Notation ─────────────────────────────── */
function moveToSAN(stBefore, mv) {
  if (mv.castle) return appendCheckSuffix(stBefore, mv, mv.castle === 'k' ? 'O-O' : 'O-O-O');

  const piece = stBefore.board[mv.from];
  let str = piece.type === 'p' ? '' : piece.type.toUpperCase();

  if (piece.type !== 'p') {
    const ambiguous = [];
    const total = stBefore.width * stBefore.height;
    for (let i = 0; i < total; i++) {
      if (i === mv.from) continue;
      const p = stBefore.board[i];
      if (!p || p.type !== piece.type || p.color !== piece.color) continue;
      if (legalMoves(stBefore, i).some(m => m.to === mv.to)) ambiguous.push(i);
    }
    if (ambiguous.length) {
      const sameFile = ambiguous.some(i => fileOf(stBefore, i) === fileOf(stBefore, mv.from));
      const sameRank = ambiguous.some(i => rankOf(stBefore, i) === rankOf(stBefore, mv.from));
      if (!sameFile)      str += fileChar(stBefore, mv.from);
      else if (!sameRank) str += rankChar(stBefore, mv.from);
      else                str += fileChar(stBefore, mv.from) + rankChar(stBefore, mv.from);
    }
  }
  if (mv.capture) {
    if (piece.type === 'p') str += fileChar(stBefore, mv.from);
    str += 'x';
  }
  str += squareName(stBefore, mv.to);
  if (mv.promo) str += '=' + mv.promo.toUpperCase();
  return appendCheckSuffix(stBefore, mv, str);
}

function appendCheckSuffix(stBefore, mv, str) {
  const after = cloneState(stBefore);
  applyMoveTo(after, mv);
  refreshStatus(after);
  if (after.status === 'checkmate') return str + '#';
  if (after.status === 'check')     return str + '+';
  return str;
}

/* ── Piece display (custom image or unicode glyph) ───────────── */
function renderPieceNode(piece) {
  const cust = state && state.custom && state.custom.pieces && state.custom.pieces[piece.type];
  const url = cust && (piece.color === 'w' ? cust.wImg : cust.bImg);
  if (url) {
    const img = document.createElement('img');
    img.className = 'sq__img';
    img.src = url;
    img.alt = piece.type;
    img.draggable = false;
    img.onerror = () => {
      // Fall back to glyph if the image fails to load
      const span = document.createElement('span');
      span.className = 'sq__piece sq__piece--' + piece.color;
      span.textContent = PIECE_CHAR[piece.type];
      img.replaceWith(span);
    };
    return img;
  }
  const span = document.createElement('span');
  span.className = 'sq__piece sq__piece--' + piece.color;
  span.textContent = PIECE_CHAR[piece.type];
  return span;
}

function playPieceSound(type, kind) {
  const piece = state && state.custom && state.custom.pieces && state.custom.pieces[type];
  if (!piece) return;
  // Backward compat: old presets stored the kill sound as `sound`.
  let url = piece[kind];
  if (!url && kind === 'killSound') url = piece.sound;
  if (!url) return;
  try {
    const audio = new Audio(url);
    audio.volume = 0.85;
    audio.play().catch(() => {});
  } catch (e) {}
}

/* ── UI rendering ────────────────────────────────────────────── */
function isGameOver() {
  return state && (
    state.status === 'checkmate' ||
    state.status === 'stalemate' ||
    state.status === 'draw' ||
    state.status === 'timeout'
  );
}

function renderBoard() {
  if (!state) return;
  boardEl.innerHTML = '';
  boardEl.style.setProperty('--cells', state.width);

  const W = state.width, H = state.height;
  const order = [];
  for (let r = 0; r < H; r++) for (let f = 0; f < W; f++) order.push(r * W + f);
  if (flipped) order.reverse();

  const inCheckIdx = (state.status === 'check' || state.status === 'checkmate')
    ? findKing(state, state.turn) : -1;

  for (const idx of order) {
    const f = fileOf(state, idx), r = rankOf(state, idx);
    const isLight = (f + r) % 2 === 0;
    const sq = document.createElement('button');
    sq.type = 'button';
    sq.className = 'sq ' + (isLight ? 'sq--light' : 'sq--dark');
    sq.dataset.i = idx;
    sq.setAttribute('aria-label', squareName(state, idx));

    if (lastMove && (lastMove.from === idx || lastMove.to === idx)) sq.classList.add('sq--last');
    if (selected === idx) sq.classList.add('sq--sel');
    if (idx === inCheckIdx) sq.classList.add('sq--check');

    const target = legalForSelected.find(m => m.to === idx);
    if (target) sq.classList.add(target.capture || target.enPassant ? 'sq--legal-cap' : 'sq--legal');

    const piece = state.board[idx];
    if (piece) {
      sq.appendChild(renderPieceNode(piece));
    }

    const isLeftCol   = flipped ? (f === W - 1) : (f === 0);
    const isBottomRow = flipped ? (r === 0)     : (r === H - 1);
    if (isLeftCol) {
      const c = document.createElement('span');
      c.className = 'sq__coord sq__coord--rank';
      c.textContent = rankChar(state, idx);
      sq.appendChild(c);
    }
    if (isBottomRow) {
      const c = document.createElement('span');
      c.className = 'sq__coord sq__coord--file';
      c.textContent = fileChar(state, idx);
      sq.appendChild(c);
    }

    sq.addEventListener('click', () => onSquareClick(idx));
    boardEl.appendChild(sq);
  }
}

function renderTags() {
  const topColor = flipped ? 'w' : 'b';
  const botColor = flipped ? 'b' : 'w';
  tagTop.textContent    = COLOR_NAME[topColor];
  tagBottom.textContent = COLOR_NAME[botColor];
  const live = !isGameOver();
  tagTop.classList.toggle('player-tag--turn',    live && state.turn === topColor);
  tagBottom.classList.toggle('player-tag--turn', live && state.turn === botColor);
}

function renderCaptures() {
  const topColor = flipped ? 'w' : 'b';
  const botColor = flipped ? 'b' : 'w';
  captureTop.innerHTML    = formatCaptures(state.captured[topColor]);
  captureBottom.innerHTML = formatCaptures(state.captured[botColor]);
}

function formatCaptures(list) {
  return list.slice()
    .sort((a, b) => VALUE[b.type] - VALUE[a.type])
    .map(p => `<span class="cap cap--${p.color}">${PIECE_CHAR[p.type]}</span>`)
    .join('');
}

function renderClocks() {
  if (!state || !state.clocks) {
    clockTop.hidden = true;
    clockBottom.hidden = true;
    return;
  }
  clockTop.hidden = false;
  clockBottom.hidden = false;
  const topColor = flipped ? 'w' : 'b';
  const botColor = flipped ? 'b' : 'w';
  const topMs = currentRemaining(topColor);
  const botMs = currentRemaining(botColor);
  clockTop.textContent    = formatClock(topMs);
  clockBottom.textContent = formatClock(botMs);
  const running = !isGameOver();
  clockTop.classList.toggle('clock--running',    running && state.turn === topColor);
  clockBottom.classList.toggle('clock--running', running && state.turn === botColor);
  clockTop.classList.toggle('clock--low',    running && topMs < 10000);
  clockBottom.classList.toggle('clock--low', running && botMs < 10000);
}

function renderStatus() {
  let text = '', kind = 'neutral';
  if (state.status === 'checkmate') {
    text = `Checkmate — ${COLOR_NAME[state.result]} wins.`;
    kind = 'good';
  } else if (state.status === 'stalemate') {
    if (state.result === 'draw') {
      text = 'Stalemate — draw.';
      kind = 'warn';
    } else {
      text = `Stalemate — ${COLOR_NAME[state.result]} wins.`;
      kind = 'good';
    }
  } else if (state.status === 'draw') {
    text = 'Draw — 50-move rule.';
    kind = 'warn';
  } else if (state.status === 'timeout') {
    text = `Time out — ${COLOR_NAME[state.result]} wins.`;
    kind = 'good';
  } else if (state.status === 'check') {
    text = `${COLOR_NAME[state.turn]} to move — check!`;
    kind = 'bad';
  } else {
    text = `${COLOR_NAME[state.turn]} to move.`;
    kind = 'neutral';
  }
  gameStatus.textContent = text;
  gameStatus.className = 'status status--' + kind;
}

function renderHistory() {
  historyList.innerHTML = '';
  for (let i = 0; i < state.moves.length; i += 2) {
    const li = document.createElement('li');
    li.style.display = 'contents';
    const num = document.createElement('span');
    num.className = 'history__num';
    num.textContent = (i / 2 + 1) + '.';
    const w = document.createElement('span');
    w.className = 'history__white';
    w.textContent = state.moves[i] || '';
    const b = document.createElement('span');
    b.className = 'history__black';
    b.textContent = state.moves[i+1] || '';
    li.appendChild(num);
    li.appendChild(w);
    li.appendChild(b);
    historyList.appendChild(li);
  }
  historyList.scrollTop = historyList.scrollHeight;
}

function render() {
  if (!state) return;
  renderBoard();
  renderTags();
  renderCaptures();
  renderClocks();
  renderStatus();
  renderHistory();
  renderActionButton();
}

function renderActionButton() {
  const isOver  = isGameOver();
  const kind    = isOver ? 'restart' : 'undo';
  const baseLbl = kind === 'restart' ? 'Restart' : 'Undo';

  // If the situation changed under us, drop a stale vote
  if (pendingVote.kind && pendingVote.kind !== kind) resetVote();

  if (mode === 'single') {
    btnRestart.textContent = baseLbl;
    // No undoable moves yet → disable. Restart is always available.
    btnRestart.disabled = (kind === 'undo') && undoStack.length === 0;
    return;
  }

  // Online: vote-based — show count, mark when local has voted
  const count = (pendingVote.kind === kind ? (pendingVote.mine ? 1 : 0) + (pendingVote.theirs ? 1 : 0) : 0);
  const voted = pendingVote.kind === kind && pendingVote.mine;
  btnRestart.textContent = `${voted ? '✓ ' : ''}${baseLbl} ${count}/2`;
  btnRestart.disabled = false;
}

/* ── Clock ───────────────────────────────────────────────────── */
function startClockTick() {
  stopClockTick();
  clockTickHandle = setInterval(tickClock, 100);
}

function stopClockTick() {
  if (clockTickHandle) {
    clearInterval(clockTickHandle);
    clockTickHandle = null;
  }
}

function tickClock() {
  if (!state || !state.clocks || isGameOver()) {
    stopClockTick();
    return;
  }
  const remaining = currentRemaining(state.turn);
  if (remaining <= 0) {
    state.clocks[state.turn] = 0;
    state.status = 'timeout';
    state.result = state.turn === 'w' ? 'b' : 'w';
    clockStartedAt = null;
    pendingPromo = null;
    promoModal.hidden = true;
    selected = null;
    legalForSelected = [];
    stopClockTick();
    render();
  } else {
    renderClocks();
  }
}

function currentRemaining(color) {
  if (!state || !state.clocks) return Infinity;
  let ms = state.clocks[color];
  if (color === state.turn && clockStartedAt !== null && !isGameOver()) {
    ms -= Date.now() - clockStartedAt;
  }
  return Math.max(0, ms);
}

function formatClock(ms) {
  ms = Math.max(0, ms);
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (totalSec < 10) {
    const tenths = Math.floor((ms % 1000) / 100);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${tenths}`;
  }
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ── Move execution ──────────────────────────────────────────── */
function onSquareClick(idx) {
  if (isGameOver() || pendingPromo) return;
  // Online guest: only allow interaction on own turn
  if (mode !== 'single' && state.turn !== myColor) return;

  const piece = state.board[idx];

  if (selected !== null) {
    const matches = legalForSelected.filter(m => m.to === idx);
    if (matches.length === 1) { commitMove(matches[0]); return; }
    if (matches.length  >  1) { showPromotion(matches);   return; }
    if (piece && piece.color === state.turn) {
      selected = idx;
      legalForSelected = legalMoves(state, idx);
      render();
      return;
    }
    selected = null;
    legalForSelected = [];
    render();
    return;
  }

  if (piece && piece.color === state.turn) {
    selected = idx;
    legalForSelected = legalMoves(state, idx);
    render();
  }
}

function commitMove(mv) {
  if (mode === 'guest') sendMoveToHost(mv);
  else                  finalizeMove(mv);
}

function showPromotion(candidates) {
  pendingPromo = candidates;
  promoModal.hidden = false;
}

function finalizeMove(mv) {
  const moverColor = state.turn;
  const before = cloneState(state);

  // Subtract elapsed time & add increment for the moving side
  let timedOut = false;
  if (state.clocks && clockStartedAt !== null) {
    const elapsed = Date.now() - clockStartedAt;
    state.clocks[moverColor] -= elapsed;
    if (state.clocks[moverColor] <= 0) {
      state.clocks[moverColor] = 0;
      timedOut = true;
    } else {
      state.clocks[moverColor] += (state.timeControl.increment || 0) * 1000;
    }
  }

  if (timedOut) {
    state.status = 'timeout';
    state.result = moverColor === 'w' ? 'b' : 'w';
    clockStartedAt = null;
    stopClockTick();
    undoStack.push(before);
    selected = null;
    legalForSelected = [];
    render();
    return;
  }

  undoStack.push(before);
  const moverPiece = before.board[mv.from];
  const moverType = moverPiece ? moverPiece.type : null;
  applyMoveTo(state, mv);
  refreshStatus(state);
  state.moves.push(moveToSAN(before, mv));
  lastMove = { from: mv.from, to: mv.to };
  selected = null;
  legalForSelected = [];

  let victimType = null;
  if (mv.capture) {
    const captures = state.captured[moverColor];
    const victim = captures[captures.length - 1];
    if (victim) victimType = victim.type;
  }
  playMoveSounds(mv, moverType, victimType);

  if (isGameOver()) {
    clockStartedAt = null;
    stopClockTick();
  } else if (state.clocks) {
    clockStartedAt = Date.now();
  }

  // Any pending vote is no longer relevant — a move has happened
  resetVote();

  // Online: host broadcasts the result so the guest stays in sync
  if (mode === 'host' && conn && conn.open) {
    try { conn.send({ type: 'state', state, mv, moverType, victimType }); } catch (e) {}
  }

  render();
}

function playMoveSounds(mv, moverType, victimType) {
  if (!moverType || !mv) return;
  if (mv.capture) {
    playPieceSound(moverType, 'killSound');
    if (victimType) playPieceSound(victimType, 'dieSound');
  } else {
    playPieceSound(moverType, 'moveSound');
  }
}

function sendMoveToHost(mv) {
  if (conn && conn.open) {
    try { conn.send({ type: 'move', mv }); } catch (e) {}
  }
}

document.querySelectorAll('.promo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!pendingPromo) return;
    const mv = pendingPromo.find(m => m.promo === btn.dataset.promo);
    pendingPromo = null;
    promoModal.hidden = true;
    if (mv) commitMove(mv);
  });
});

/* ── Game-screen buttons ─────────────────────────────────────── */
function resetVote() {
  pendingVote = { kind: null, mine: false, theirs: false };
}

function performUndo() {
  if (!undoStack.length) return;
  state = undoStack.pop();
  selected = null;
  legalForSelected = [];
  lastMove = null;
  if (state.clocks && !isGameOver()) {
    clockStartedAt = Date.now();
    startClockTick();
  } else {
    clockStartedAt = null;
    stopClockTick();
  }
  // Online: host broadcasts restored state to guest
  if (mode === 'host' && conn && conn.open) {
    try {
      conn.send({ type: 'state', state, mv: null, moverType: null, victimType: null });
    } catch (e) {}
  }
  render();
}

function fireVotedAction(kind) {
  if (kind === 'restart') {
    if (currentConfig) startGame(currentConfig, currentCustom);
  } else if (kind === 'undo') {
    performUndo();
  }
}

function checkVoteResult() {
  if (pendingVote.mine && pendingVote.theirs) {
    const kind = pendingVote.kind;
    resetVote();
    // Only the host actually mutates state — guest just clears the vote and
    // waits for the host's next state broadcast.
    if (mode === 'host') fireVotedAction(kind);
  }
}

function sendVote(kind, vote) {
  if (conn && conn.open) {
    try { conn.send({ type: 'vote', kind, vote }); } catch (e) {}
  }
}

function receiveVote(kind, vote) {
  if (pendingVote.kind !== kind) {
    pendingVote = { kind, mine: false, theirs: vote };
  } else {
    pendingVote.theirs = vote;
  }
  checkVoteResult();
  render();
}

btnRestart.addEventListener('click', () => {
  if (!state) return;
  const kind = isGameOver() ? 'restart' : 'undo';

  if (mode === 'single') {
    fireVotedAction(kind);
    return;
  }

  // Online: toggle local vote and notify opponent
  if (pendingVote.kind !== kind) {
    pendingVote = { kind, mine: true, theirs: false };
  } else {
    pendingVote.mine = !pendingVote.mine;
  }
  sendVote(kind, pendingVote.mine);
  checkVoteResult();
  render();
});

btnFlip.addEventListener('click', () => {
  flipped = !flipped;
  if (state) render();
});

btnMenu.addEventListener('click', () => {
  if (mode === 'single') {
    state = null;
    undoStack = [];
    stopClockTick();
    clockStartedAt = null;
    pendingPromo = null;
    promoModal.hidden = true;
    showScreen('menu');
  } else {
    leaveOnline();
  }
});

function leaveOnline() {
  teardownConnection();
  state = null;
  undoStack = [];
  stopClockTick();
  clockStartedAt = null;
  pendingPromo = null;
  promoModal.hidden = true;
  mode = 'single';
  updateStartGameButton();
  showScreen('title');
}

/* ── Menu / config form ──────────────────────────────────────── */
function readConfigFromForm() {
  return {
    timeControl: {
      mode: timeMode.value,
      minutes: Math.max(1, parseInt(timeMinutes.value) || 5),
      increment: Math.max(0, parseInt(timeIncrement.value) || 0),
    },
    rules: {
      stalemate: stalemateRule.value,
      fiftyMoveRule: fiftyMoveRule.checked,
    },
    size: parseInt(document.querySelector('input[name="boardSize"]:checked').value, 10),
    firstMove: document.querySelector('input[name="firstMove"]:checked').value,
    useCustomPieces: useCustomPieces.checked,
  };
}

function writeConfigToForm(cfg) {
  timeMode.value      = cfg.timeControl.mode;
  timeMinutes.value   = cfg.timeControl.minutes;
  timeIncrement.value = cfg.timeControl.increment;
  stalemateRule.value = cfg.rules.stalemate;
  fiftyMoveRule.checked = !!cfg.rules.fiftyMoveRule;
  useCustomPieces.checked = !!cfg.useCustomPieces;
  const sizeRadio = document.querySelector(`input[name="boardSize"][value="${cfg.size}"]`);
  if (sizeRadio) sizeRadio.checked = true;
  const firstRadio = document.querySelector(`input[name="firstMove"][value="${cfg.firstMove}"]`);
  if (firstRadio) firstRadio.checked = true;
  updateTimeFieldsVisibility();
}

function updateTimeFieldsVisibility() {
  timeFields.hidden = (timeMode.value !== 'side');
}

timeMode.addEventListener('change', updateTimeFieldsVisibility);

/* ── Presets (localStorage) ──────────────────────────────────── */
function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function savePresets(presets) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); }
  catch (e) { console.warn('Could not save presets:', e); }
}

function refreshPresetSelect(selectName) {
  const presets = loadPresets();
  presetSelect.innerHTML = '';
  const def = document.createElement('option');
  def.value = '';
  def.textContent = '— Defaults —';
  presetSelect.appendChild(def);
  presets.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    presetSelect.appendChild(opt);
  });
  if (selectName) {
    const idx = presets.findIndex(p => p.name === selectName);
    if (idx >= 0) presetSelect.value = String(idx);
  }
}

presetSelect.addEventListener('change', () => {
  const v = presetSelect.value;
  if (v === '') { writeConfigToForm(DEFAULT_CONFIG); return; }
  const presets = loadPresets();
  const p = presets[parseInt(v, 10)];
  if (p) writeConfigToForm(p.config);
});

btnSavePreset.addEventListener('click', () => {
  const name = (prompt('Name for this preset:') || '').trim();
  if (!name) return;
  const presets = loadPresets();
  const cfg = readConfigFromForm();
  const existingIdx = presets.findIndex(p => p.name === name);
  if (existingIdx >= 0) {
    if (!confirm(`Preset "${name}" already exists. Overwrite?`)) return;
    presets[existingIdx] = { name, config: cfg };
  } else {
    presets.push({ name, config: cfg });
  }
  savePresets(presets);
  refreshPresetSelect(name);
});

btnDeletePreset.addEventListener('click', () => {
  const v = presetSelect.value;
  if (v === '') return;
  const presets = loadPresets();
  const p = presets[parseInt(v, 10)];
  if (!p) return;
  if (!confirm(`Delete preset "${p.name}"?`)) return;
  presets.splice(parseInt(v, 10), 1);
  savePresets(presets);
  refreshPresetSelect();
  presetSelect.value = '';
});

btnDefaultPreset.addEventListener('click', () => {
  writeConfigToForm(DEFAULT_CONFIG);
  presetSelect.value = '';
});

/* ── Game lifecycle ──────────────────────────────────────────── */
function showScreen(name) {
  for (const k of Object.keys(screens)) {
    screens[k].hidden = (k !== name);
  }
  document.body.dataset.screen = name;
  // Replay the screen-in animation by retriggering the keyframe
  const el = screens[name];
  if (el) {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }
}

function updateStartGameButton() {
  const label = mode === 'host' ? 'Create Lobby' : 'Start Game';
  if (btnStartGame)       btnStartGame.textContent = label;
  if (btnStartCustomGame) btnStartCustomGame.textContent = label;
}

btnSinglePlayer.addEventListener('click', () => {
  mode = 'single';
  updateStartGameButton();
  showScreen('menu');
});

btnOnline.addEventListener('click', () => {
  if (typeof Peer === 'undefined') {
    setOnlineStatus(onlineStatus, 'PeerJS failed to load — check your connection and reload.', 'bad');
  } else {
    setOnlineStatus(onlineStatus, '', 'neutral');
  }
  showScreen('online');
});

btnBackToTitle.addEventListener('click', () => {
  if (mode === 'host') {
    showScreen('online');
  } else {
    mode = 'single';
    updateStartGameButton();
    showScreen('title');
  }
});

function startGame(cfg, customCfg) {
  currentConfig = JSON.parse(JSON.stringify(cfg));
  currentCustom = customCfg ? JSON.parse(JSON.stringify(customCfg)) : null;
  try { localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(cfg)); } catch (e) {}

  state = freshGame(cfg, customCfg);
  undoStack = [];
  selected = null;
  legalForSelected = [];
  lastMove = null;
  pendingPromo = null;
  promoModal.hidden = true;

  refreshStatus(state);

  if (state.clocks) {
    clockStartedAt = Date.now();
    startClockTick();
  } else {
    clockStartedAt = null;
    stopClockTick();
  }

  if (mode === 'host') flipped = false;
  if (mode === 'guest') flipped = (myColor === 'b');

  resetVote();
  showScreen('game');
  render();

  // Online host: bring the guest to the same starting state
  if (mode === 'host' && conn && conn.open) {
    try {
      conn.send({
        type: 'welcome',
        yourColor: 'b',
        matchCfg: cfg,
        customCfg: customCfg,
        state: state,
      });
    } catch (e) {}
  }
}

btnStartGame.addEventListener('click', () => {
  const cfg = readConfigFromForm();
  if (cfg.useCustomPieces) {
    pendingMatchConfig = cfg;
    openCustomizeScreen();
  } else if (mode === 'host') {
    createLobby(cfg, null);
  } else {
    startGame(cfg, null);
  }
});

/* ── Customize-pieces page ──────────────────────────────────── */
function buildPieceCards() {
  pieceList.innerHTML = '';
  for (const t of PIECE_TYPES) {
    const row = document.createElement('div');
    row.className = 'piece-row';
    const head = document.createElement('div');
    head.className = 'piece-row__head';
    head.innerHTML = `
      <span class="piece-row__icon">${PIECE_CHAR[t]}</span>
      <span class="piece-row__name">${PIECE_NAMES[t]}</span>
    `;
    row.appendChild(head);

    // Image fields (stacked)
    const imgFields = [
      { field: 'wImg', label: 'White image URL' },
      { field: 'bImg', label: 'Black image URL' },
    ];
    for (const f of imgFields) {
      const wrap = document.createElement('label');
      wrap.className = 'field';
      const lab = document.createElement('span');
      lab.className = 'field__label';
      lab.textContent = f.label;
      const input = document.createElement('input');
      input.type = 'url';
      input.className = 'input';
      input.placeholder = 'https://…';
      input.dataset.piece = t;
      input.dataset.field = f.field;
      wrap.appendChild(lab);
      wrap.appendChild(input);
      row.appendChild(wrap);
    }

    // Sounds (compact 3-row block)
    const sounds = document.createElement('div');
    sounds.className = 'sounds-block';
    const soundsLab = document.createElement('span');
    soundsLab.className = 'field__label';
    soundsLab.textContent = 'Sounds';
    sounds.appendChild(soundsLab);
    const soundFields = [
      { field: 'moveSound', tag: 'Move' },
      { field: 'killSound', tag: 'Kill' },
      { field: 'dieSound',  tag: 'Die'  },
    ];
    for (const sf of soundFields) {
      const sr = document.createElement('div');
      sr.className = 'sound-row';
      const tag = document.createElement('span');
      tag.className = 'sound-row__tag';
      tag.textContent = sf.tag;
      const inp = document.createElement('input');
      inp.type = 'url';
      inp.className = 'input input--sm';
      inp.placeholder = 'https://…';
      inp.dataset.piece = t;
      inp.dataset.field = sf.field;
      sr.appendChild(tag);
      sr.appendChild(inp);
      sounds.appendChild(sr);
    }
    row.appendChild(sounds);

    const moveWrap = document.createElement('label');
    moveWrap.className = 'field';
    const moveLab = document.createElement('span');
    moveLab.className = 'field__label';
    moveLab.textContent = 'Movement';
    const moveSelect = document.createElement('select');
    moveSelect.className = 'select';
    moveSelect.dataset.piece = t;
    moveSelect.dataset.field = 'movement';
    for (const o of MOVEMENT_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      moveSelect.appendChild(opt);
    }
    moveWrap.appendChild(moveLab);
    moveWrap.appendChild(moveSelect);
    row.appendChild(moveWrap);

    pieceList.appendChild(row);
  }
}

function readCustomFromForm() {
  const out = blankCustom();
  pieceList.querySelectorAll('input[data-piece], select[data-piece]').forEach(el => {
    const t = el.dataset.piece, f = el.dataset.field;
    if (out.pieces[t]) out.pieces[t][f] = el.value || '';
  });
  return out;
}

function writeCustomToForm(custom) {
  const cust = (custom && custom.pieces) ? custom : blankCustom();
  pieceList.querySelectorAll('input[data-piece], select[data-piece]').forEach(el => {
    const t = el.dataset.piece, f = el.dataset.field;
    const piece = cust.pieces[t] || {};
    let val = piece[f];
    // Migrate old presets that stored a single `sound` field
    if (f === 'killSound' && (val == null || val === '') && piece.sound) val = piece.sound;
    el.value = val != null ? val : (f === 'movement' ? 'default' : '');
  });
}

function loadCustomPresets() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveCustomPresets(presets) {
  try { localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets)); }
  catch (e) { console.warn('Could not save piece presets:', e); }
}

function refreshCustomPresetSelect(selectName) {
  const presets = loadCustomPresets();
  customPresetSelect.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '— Blank —';
  customPresetSelect.appendChild(blank);
  presets.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    customPresetSelect.appendChild(opt);
  });
  if (selectName) {
    const idx = presets.findIndex(p => p.name === selectName);
    if (idx >= 0) customPresetSelect.value = String(idx);
  }
}

customPresetSelect.addEventListener('change', () => {
  const v = customPresetSelect.value;
  if (v === '') { writeCustomToForm(blankCustom()); return; }
  const presets = loadCustomPresets();
  const p = presets[parseInt(v, 10)];
  if (p) writeCustomToForm(p.data);
});

btnSaveCustomPreset.addEventListener('click', () => {
  const name = (prompt('Name for this piece preset:') || '').trim();
  if (!name) return;
  const presets = loadCustomPresets();
  const data = readCustomFromForm();
  const existingIdx = presets.findIndex(p => p.name === name);
  if (existingIdx >= 0) {
    if (!confirm(`Preset "${name}" already exists. Overwrite?`)) return;
    presets[existingIdx] = { name, data };
  } else {
    presets.push({ name, data });
  }
  saveCustomPresets(presets);
  refreshCustomPresetSelect(name);
});

btnDeleteCustomPreset.addEventListener('click', () => {
  const v = customPresetSelect.value;
  if (v === '') return;
  const presets = loadCustomPresets();
  const p = presets[parseInt(v, 10)];
  if (!p) return;
  if (!confirm(`Delete preset "${p.name}"?`)) return;
  presets.splice(parseInt(v, 10), 1);
  saveCustomPresets(presets);
  refreshCustomPresetSelect();
  customPresetSelect.value = '';
});

btnDefaultCustomPreset.addEventListener('click', () => {
  writeCustomToForm(blankCustom());
  customPresetSelect.value = '';
});

function openCustomizeScreen() {
  let custom;
  try {
    const raw = localStorage.getItem(LAST_CUSTOM_KEY);
    custom = raw ? JSON.parse(raw) : blankCustom();
  } catch (e) { custom = blankCustom(); }
  writeCustomToForm(custom);
  refreshCustomPresetSelect();
  customPresetSelect.value = '';
  showScreen('customize');
}

btnCustomizeBack.addEventListener('click', () => showScreen('menu'));

btnStartCustomGame.addEventListener('click', () => {
  const customCfg = readCustomFromForm();
  try { localStorage.setItem(LAST_CUSTOM_KEY, JSON.stringify(customCfg)); } catch (e) {}
  if (!pendingMatchConfig) pendingMatchConfig = readConfigFromForm();
  if (mode === 'host') {
    createLobby(pendingMatchConfig, customCfg);
  } else {
    startGame(pendingMatchConfig, customCfg);
  }
  pendingMatchConfig = null;
});

/* ── Online play (PeerJS) ───────────────────────────────────── */
function setOnlineStatus(el, text, kind) {
  if (!el) return;
  el.textContent = text || ' ';
  el.className = 'status' + (kind ? ' status--' + kind : '');
}

function generateCode() {
  let s = '';
  const buf = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(buf);
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return s;
}

function ensurePeer(customId) {
  if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
  peer = customId ? new Peer(customId) : new Peer();
  peer.on('error', (err) => {
    console.warn('[Peer] error:', err);
    if (err.type === 'unavailable-id') {
      setOnlineStatus(hostStatus, 'Lobby code already in use — try again.', 'bad');
    } else if (err.type === 'peer-unavailable') {
      setOnlineStatus(joinStatus, 'No lobby with that code is open.', 'bad');
      btnJoinConnect.disabled = false;
    } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
      const target = mode === 'guest' ? joinStatus : hostStatus;
      setOnlineStatus(target, 'Network error contacting the broker.', 'bad');
    } else {
      const target = mode === 'guest' ? joinStatus : hostStatus;
      setOnlineStatus(target, 'Peer error: ' + err.type, 'bad');
    }
  });
}

function teardownConnection() {
  if (conn) { try { conn.close(); } catch (_) {} conn = null; }
  if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
  myColor = null;
}

function createLobby(matchCfg, customCfg) {
  const code = generateCode();
  lobbyCodeEl.textContent = code;
  setOnlineStatus(hostStatus, 'Connecting to broker…', 'neutral');
  showScreen('hostWait');

  ensurePeer(ID_PREFIX + code);

  peer.on('open', () => {
    setOnlineStatus(hostStatus, 'Waiting for guest to join…', 'neutral');
  });

  peer.on('connection', (incoming) => {
    if (conn && conn.open) {
      // Lobby already full — politely refuse
      incoming.on('open', () => {
        try { incoming.send({ type: 'reject', reason: 'lobby-full' }); } catch (_) {}
        setTimeout(() => { try { incoming.close(); } catch (_) {} }, 100);
      });
      return;
    }

    incoming.on('open', () => {
      conn = incoming;
      myColor = 'w';
      // startGame will broadcast 'welcome' since mode === 'host' and conn is set
      startGame(matchCfg, customCfg);
    });

    incoming.on('data', (msg) => handleHostMessage(msg));
    incoming.on('close', () => onConnClosed());
    incoming.on('error', (e) => console.warn('[Host conn] error:', e));
  });
}

function joinLobby(code) {
  setOnlineStatus(joinStatus, 'Connecting to broker…', 'neutral');
  btnJoinConnect.disabled = true;
  ensurePeer(null);

  peer.on('open', () => {
    setOnlineStatus(joinStatus, 'Reaching host…', 'neutral');
    const c = peer.connect(ID_PREFIX + code, { reliable: true });
    conn = c;
    c.on('open', () => {
      setOnlineStatus(joinStatus, 'Connected — waiting for game start…', 'good');
    });
    c.on('data', (msg) => handleGuestMessage(msg));
    c.on('close', () => onConnClosed());
    c.on('error', (e) => console.warn('[Guest conn] error:', e));
  });
}

function onConnClosed() {
  conn = null;
  if (state) {
    gameStatus.textContent = 'Opponent disconnected.';
    gameStatus.className = 'status status--warn';
    stopClockTick();
  } else if (mode === 'guest') {
    setOnlineStatus(joinStatus, 'Connection closed.', 'bad');
    btnJoinConnect.disabled = false;
  } else if (mode === 'host') {
    setOnlineStatus(hostStatus, 'Guest disconnected.', 'warn');
  }
}

function handleHostMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'move') {
    if (!state) return;
    const mv = msg.mv;
    if (!mv || typeof mv !== 'object') return;
    if (state.turn === myColor) return; // not the guest's turn
    const legal = legalMoves(state, mv.from);
    const found = legal.find(m =>
      m.from === mv.from && m.to === mv.to && (m.promo || null) === (mv.promo || null)
    );
    if (!found) return;
    finalizeMove(found);
  } else if (msg.type === 'vote') {
    receiveVote(msg.kind, msg.vote);
  }
}

function handleGuestMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'reject') {
    const reason = ({ 'lobby-full': 'Lobby is full.' })[msg.reason] || ('Rejected: ' + msg.reason);
    setOnlineStatus(joinStatus, reason, 'bad');
    btnJoinConnect.disabled = false;
    teardownConnection();
    return;
  }
  if (msg.type === 'welcome') {
    myColor = msg.yourColor;
    currentConfig = msg.matchCfg;
    currentCustom = msg.customCfg;
    state = msg.state;
    undoStack = [];
    selected = null;
    legalForSelected = [];
    lastMove = null;
    pendingPromo = null;
    promoModal.hidden = true;
    flipped = (myColor === 'b');
    if (state && state.clocks) {
      clockStartedAt = Date.now();
      startClockTick();
    } else {
      clockStartedAt = null;
      stopClockTick();
    }
    resetVote();
    showScreen('game');
    render();
    return;
  }
  if (msg.type === 'state') {
    state = msg.state;
    if (msg.moverType) playMoveSounds(msg.mv, msg.moverType, msg.victimType || null);
    if (msg.mv && msg.mv.from != null) lastMove = { from: msg.mv.from, to: msg.mv.to };
    else lastMove = null;
    selected = null;
    legalForSelected = [];
    pendingPromo = null;
    promoModal.hidden = true;
    if (state && state.clocks && !isGameOver()) {
      clockStartedAt = Date.now();
      startClockTick();
    } else {
      clockStartedAt = null;
      stopClockTick();
    }
    resetVote();
    render();
    return;
  }
  if (msg.type === 'vote') {
    receiveVote(msg.kind, msg.vote);
    return;
  }
}

/* ── Online navigation ─────────────────────────────────────── */
btnOnlineBack.addEventListener('click', () => {
  teardownConnection();
  mode = 'single';
  updateStartGameButton();
  showScreen('title');
});

btnHostLobby.addEventListener('click', () => {
  if (typeof Peer === 'undefined') {
    setOnlineStatus(onlineStatus, 'PeerJS failed to load — reload the page.', 'bad');
    return;
  }
  mode = 'host';
  updateStartGameButton();
  showScreen('menu');
});

btnJoinLobby.addEventListener('click', () => {
  if (typeof Peer === 'undefined') {
    setOnlineStatus(onlineStatus, 'PeerJS failed to load — reload the page.', 'bad');
    return;
  }
  mode = 'guest';
  joinCodeEl.value = '';
  setOnlineStatus(joinStatus, '', 'neutral');
  btnJoinConnect.disabled = false;
  showScreen('join');
});

btnHostCancel.addEventListener('click', () => {
  teardownConnection();
  mode = 'single';
  updateStartGameButton();
  showScreen('online');
});

btnJoinBack.addEventListener('click', () => {
  teardownConnection();
  mode = 'single';
  showScreen('online');
});

btnJoinConnect.addEventListener('click', () => {
  const code = (joinCodeEl.value || '').trim().toUpperCase();
  if (code.length !== CODE_LEN) {
    setOnlineStatus(joinStatus, `Code must be ${CODE_LEN} characters.`, 'bad');
    return;
  }
  joinLobby(code);
});

joinCodeEl.addEventListener('input', () => {
  joinCodeEl.value = joinCodeEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

/* ── Boot ────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  buildPieceCards();
  refreshPresetSelect();
  refreshCustomPresetSelect();
  try {
    const last = localStorage.getItem(LAST_CONFIG_KEY);
    writeConfigToForm(last ? JSON.parse(last) : DEFAULT_CONFIG);
  } catch (e) {
    writeConfigToForm(DEFAULT_CONFIG);
  }
  updateStartGameButton();
  showScreen('title');
});
