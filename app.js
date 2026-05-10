/* ============================================================
   Chess — Pass-and-Play PWA Prototype  v0.4.0
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
  profile:   $('screen-profile'),
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
const btnProfile      = $('btnProfile');

// profile controls
const btnProfileBack    = $('btnProfileBack');
const profileName       = $('profileName');
const profilePicUrl     = $('profilePicUrl');
const profilePicPreview = $('profilePicPreview');
const profileSfxVolume     = $('profileSfxVolume');
const profileMusicVolume   = $('profileMusicVolume');
const sfxVolumeDisplay     = $('sfxVolumeDisplay');
const musicVolumeDisplay   = $('musicVolumeDisplay');
const profileBgColor    = $('profileBgColor');
const profileBgImage    = $('profileBgImage');
const bgColorWrap       = $('bgColorWrap');
const profileMenuMusic  = $('profileMenuMusic');
const profileBattleMusic= $('profileBattleMusic');
const profileVictory    = $('profileVictory');
const btnSaveProfile    = $('btnSaveProfile');
const btnDefaultProfile = $('btnDefaultProfile');
const btnExportProfile  = $('btnExportProfile');
const btnImportProfile  = $('btnImportProfile');
const profileImportFile = $('profileImportFile');

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
const gameModeSelect  = $('gameMode');
const timeMode        = $('timeMode');
const timeFields      = $('timeFields');
const timeMinutes     = $('timeMinutes');
const timeIncrement   = $('timeIncrement');
const stalemateRule   = $('stalemateRule');
const fiftyMoveRule   = $('fiftyMoveRule');
const useCustomPieces = $('useCustomPieces');
const hostColorSelect = $('hostColor');
const shareMusicEl    = $('shareMusic');
const aiOpponentSelect    = $('aiOpponent');
const aiPlayerColorSelect = $('aiPlayerColor');
const aiDifficultySelect  = $('aiDifficulty');
const btnStartGame    = $('btnStartGame');

// customize controls
const btnCustomizeBack      = $('btnCustomizeBack');
const customPresetSelect    = $('customPresetSelect');
const btnSaveCustomPreset    = $('btnSaveCustomPreset');
const btnDeleteCustomPreset  = $('btnDeleteCustomPreset');
const btnDefaultCustomPreset = $('btnDefaultCustomPreset');
const pieceEditor           = $('pieceEditor');
const btnStartCustomGame    = $('btnStartCustomGame');

// game controls
const boardEl       = $('board');
const tagTop          = $('tagTop');
const tagBottom       = $('tagBottom');
const gameBanner         = $('gameBanner');
const gameBannerIcon     = $('gameBannerIcon');
const gameBannerTitle    = $('gameBannerTitle');
const gameBannerSubtitle = $('gameBannerSubtitle');
const gameBannerClose    = $('gameBannerClose');
const clockTop        = $('clockTop');
const clockBottom     = $('clockBottom');
const profilePicTop   = $('profilePicTop');
const profilePicBot   = $('profilePicBot');
const profileNameTop  = $('profileNameTop');
const profileNameBot  = $('profileNameBot');
const powerupRowTop   = $('powerupRowTop');
const powerupRowBot   = $('powerupRowBot');
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

// Power-Ups game mode
const POWER_UP_TYPES   = ['promote', 'teleport', 'randomize'];
const POWER_UP_SYMBOLS = { promote: '↑', teleport: '⇄', randomize: '?' };
const POWER_UP_NAMES   = { promote: 'Promote', teleport: 'Teleport', randomize: 'Randomize' };
function randomPowerUpType() {
  return POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
}

const PRESETS_KEY        = 'chess_presets_v1';
const LAST_CONFIG_KEY    = 'chess_last_config_v1';
const CUSTOM_PRESETS_KEY = 'chess_piece_presets_v1';
const LAST_CUSTOM_KEY    = 'chess_last_custom_v1';

const ID_PREFIX     = 'chess-mp-v1-';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN      = 6;

// Lobby join/leave one-shot sounds
const LOBBY_JOIN_SOUND  = 'https://cdn.freesound.org/previews/30/30248_56897-hq.mp3';
const LOBBY_LEAVE_SOUND = 'https://cdn.freesound.org/previews/566/566453_5409451-hq.mp3';

const PROFILE_KEY = 'chess_profile_v1';
const DEFAULT_PROFILE = {
  name:        'Player',
  picUrl:      '',
  sfxVolume:   85,         // move/kill/die/victory sounds
  musicVolume: 60,         // background music tracks
  bgMode:      'default',  // 'default' | 'color' | 'image'
  bgColor:     '#1c130b',
  bgImage:     '',
  menuMusic:   '',
  battleMusic: '',
  victoryUrl:  '',
};

const DEFAULT_CONFIG = {
  timeControl: { mode: 'none', minutes: 5, increment: 0 },
  rules:       { stalemate: 'draw', fiftyMoveRule: true },
  size:        8,
  firstMove:   'w',
  gameMode:    'standard', // 'standard' | 'crazyhouse' | 'kingOfTheHill' | 'threeCheck'
  useCustomPieces: false,
  hostColor:   'w',   // online host only — which color the host plays
  shareMusic:  true,  // online host only — sync music URLs and follow capturer
  opponent:    'self',// single-only — 'self' (pass-and-play) | 'ai'
  playerColor: 'w',   // single-only, vs-AI — which color the human plays
  aiDifficulty: 2,    // single-only, vs-AI — search depth (1..3)
};

const MOVEMENT_PATTERNS = {
  none:       { type: 'none' },
  king:       { type: 'leap',  offsets: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] },
  knight:     { type: 'leap',  offsets: [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]] },
  rook:       { type: 'slide', dirs:    [[1,0],[-1,0],[0,1],[0,-1]] },
  bishop:     { type: 'slide', dirs:    [[1,1],[1,-1],[-1,1],[-1,-1]] },
  queen:      { type: 'slide', dirs:    [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] },
  camel:      { type: 'leap',  offsets: [[1,3],[3,1],[3,-1],[1,-3],[-1,-3],[-3,-1],[-3,1],[-1,3]] },
  archbishop: { type: 'compound', parts: ['knight', 'bishop'] },
  chancellor: { type: 'compound', parts: ['knight', 'rook'] },
};

// Movement / Attack picker options. Labels are tweaked per-dropdown in
// buildPieceEditor (so 'none' reads "Cannot move" vs "Cannot capture").
const MOVEMENT_OPTIONS = [
  { value: 'default',    label: 'Default (piece-standard)' },
  { value: 'none',       label: 'None — disabled' },
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
      moveSound: DEFAULT_PIECE_SOUNDS ? DEFAULT_PIECE_SOUNDS.moveSound : '',
      killSound: DEFAULT_PIECE_SOUNDS ? DEFAULT_PIECE_SOUNDS.killSound : '',
      dieSound:  DEFAULT_PIECE_SOUNDS ? DEFAULT_PIECE_SOUNDS.dieSound  : '',
      movement: 'default',
      attack:   'default',  // 'default' = capture along movement; otherwise capture-only pattern
    };
  }
  return { pieces };
}

function getAttackOverride(st, type) {
  const a = st && st.custom && st.custom.pieces && st.custom.pieces[type] && st.custom.pieces[type].attack;
  if (!a || a === 'default') return null;
  return MOVEMENT_PATTERNS[a] || null;
}

/* ── Game state ──────────────────────────────────────────────── */
let state              = null;   // active game state, or null when in menu
let currentConfig      = null;   // match config used to create `state`
let currentCustom      = null;   // custom-piece config bound to `state`
let pendingMatchConfig = null;   // match config in flight while user customizes
let undoStack          = [];
let selected           = null;
let selectedDrop       = null;   // crazyhouse: piece type currently being dropped
let activePowerUp      = null;   // power-ups: { type, color, idx, step, sourceIdx? }
let legalForSelected   = [];
let lastMove           = null;
let flipped            = false;
let pendingPromo       = null;

// Online state
let mode    = 'single';          // 'single' | 'host' | 'guest'
let peer    = null;
let conn    = null;
let myColor = null;              // 'w' | 'b' | null  (online only)
let intentionalLeave = false;    // set briefly while we close the connection ourselves

// Single-vs-AI state
let aiTimer = null;

// Vote state for the dual-purpose action button (Undo while playing, Restart after end)
let pendingVote = { kind: null, mine: false, theirs: false };

// Profile (local + opponent's)
let profile         = { ...DEFAULT_PROFILE };
let opponentProfile = null;  // { name, picUrl } when set in online mode

// End-of-game banner state
let endedAt          = null;   // ms timestamp when the game ended (or opponent left)
let bannerShownForEnd = false; // becomes true once we've shown the end banner this game

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
    gameMode: cfg.gameMode || 'standard',
    pockets:  cfg.gameMode === 'crazyhouse' ? { w: [], b: [] } : null,
    checks:   cfg.gameMode === 'threeCheck' ? { w: 0, b: 0 } : null,
    powerUps: cfg.gameMode === 'powerUps'   ? { w: [], b: [] } : null,
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
    gameMode: s.gameMode,
    pockets:  s.pockets ? { w: s.pockets.w.slice(), b: s.pockets.b.slice() } : null,
    checks:   s.checks  ? { ...s.checks } : null,
    powerUps: s.powerUps ? { w: s.powerUps.w.slice(), b: s.powerUps.b.slice() } : null,
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
  if (!pattern || pattern.type === 'none') return moves;

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
  if (!pattern || pattern.type === 'none') return false;

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

  let moves = pseudoMovesByMovement(st, idx);

  // Attack override: replace the standard capture targets with hits from the
  // chosen attack pattern. Non-capture moves come from the movement pattern.
  const attackPat = getAttackOverride(st, piece.type);
  if (attackPat) {
    moves = moves.filter(m => !m.capture);
    let attackMoves = movesFromPattern(st, idx, attackPat).filter(m => m.capture);
    if (piece.type === 'p') {
      const promoRow = piece.color === 'w' ? 0 : st.height - 1;
      const expanded = [];
      for (const a of attackMoves) {
        if (rankOf(st, a.to) === promoRow) {
          for (const promo of ['q','r','b','n']) expanded.push({ ...a, promo });
        } else {
          expanded.push(a);
        }
      }
      attackMoves = expanded;
    }
    moves = moves.concat(attackMoves);
  }

  return moves;
}

function pseudoMovesByMovement(st, idx) {
  const piece = st.board[idx];
  if (!piece) return [];

  const override = getMovementOverride(st, piece.type);
  if (override) {
    const moves = movesFromPattern(st, idx, override);
    // Promotion is a property of the PAWN piece, not its movement.
    // If a pawn (custom-moving or not) lands on the back rank, expand the
    // single move into the four promotion choices.
    if (piece.type === 'p') {
      const promoRow = piece.color === 'w' ? 0 : st.height - 1;
      const expanded = [];
      for (const mv of moves) {
        if (rankOf(st, mv.to) === promoRow) {
          for (const promo of ['q','r','b','n']) expanded.push({ ...mv, promo });
        } else {
          expanded.push(mv);
        }
      }
      return expanded;
    }
    return moves;
  }

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
    const attackPat = getAttackOverride(st, p.type);
    if (attackPat) {
      if (patternReaches(st, i, idx, attackPat)) return true;
    } else {
      const movePat = getMovementOverride(st, p.type);
      if (movePat) {
        if (patternReaches(st, i, idx, movePat)) return true;
      } else if (defaultPieceAttacks(st, i, idx)) {
        return true;
      }
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

/* ── Crazyhouse drop moves ──────────────────────────────────── */
function dropMoves(st) {
  const out = [];
  if (!st.pockets) return out;
  const pocket = st.pockets[st.turn] || [];
  if (!pocket.length) return out;
  const types = Array.from(new Set(pocket));
  const total = st.width * st.height;
  for (const type of types) {
    for (let i = 0; i < total; i++) {
      if (st.board[i]) continue;
      // Pawns can't drop on first or last rank
      if (type === 'p') {
        const r = Math.floor(i / st.width);
        if (r === 0 || r === st.height - 1) continue;
      }
      out.push({ from: -1, to: i, drop: type });
    }
  }
  return out;
}

/* ── Apply a move (mutates state) ────────────────────────────── */
function applyMoveTo(st, mv) {
  // Power-up actions consume the player's turn, no chess move applied
  if (mv.powerUp) {
    const me = st.turn;
    if (mv.powerUp === 'promote') {
      const piece = st.board[mv.to];
      if (piece) piece.type = mv.promo || 'q';
    } else if (mv.powerUp === 'teleport') {
      st.board[mv.to]   = st.board[mv.from];
      st.board[mv.from] = null;
    } else if (mv.powerUp === 'randomize') {
      const piece = st.board[mv.to];
      if (piece) piece.type = mv.newType || 'p';
    }
    if (st.powerUps && st.powerUps[me]) {
      const idx = st.powerUps[me].indexOf(mv.powerUp);
      if (idx >= 0) st.powerUps[me].splice(idx, 1);
    }
    st.enPassant = null;
    st.halfmove++;
    if (me === 'b') st.fullmove++;
    st.turn = me === 'w' ? 'b' : 'w';
    return;
  }

  // Crazyhouse drop: place a pocket piece on an empty square
  if (mv.drop) {
    const me = st.turn;
    st.board[mv.to] = { type: mv.drop, color: me };
    if (st.pockets && st.pockets[me]) {
      const idx = st.pockets[me].indexOf(mv.drop);
      if (idx >= 0) st.pockets[me].splice(idx, 1);
    }
    st.enPassant = null;
    st.halfmove = 0;
    if (me === 'b') st.fullmove++;
    st.turn = me === 'w' ? 'b' : 'w';
    return;
  }

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
  // Crazyhouse: include drop moves that don't leave own king in check
  if (st.pockets) {
    const enemy = st.turn === 'w' ? 'b' : 'w';
    for (const mv of dropMoves(st)) {
      const test = cloneState(st);
      applyMoveTo(test, mv);
      const k = findKing(test, st.turn);
      if (k >= 0 && !isAttacked(test, k, enemy)) out.push(mv);
    }
  }
  return out;
}

/* ── Status (with configurable rules) ────────────────────────── */
function refreshStatus(st) {
  // King of the Hill: previous mover wins by reaching a center square
  if (st.gameMode === 'kingOfTheHill') {
    const W = st.width, H = st.height;
    const cf = [Math.floor((W - 1) / 2), Math.ceil((W - 1) / 2)];
    const cr = [Math.floor((H - 1) / 2), Math.ceil((H - 1) / 2)];
    const center = new Set();
    for (const f of cf) for (const r of cr) center.add(r * W + f);
    const prev = st.turn === 'w' ? 'b' : 'w';
    const k = findKing(st, prev);
    if (k >= 0 && center.has(k)) {
      st.status = 'koth-win';
      st.result = prev;
      return;
    }
  }

  // Three-Check: someone reached 3 checks delivered
  if (st.gameMode === 'threeCheck' && st.checks) {
    if ((st.checks.w || 0) >= 3) { st.status = 'three-check'; st.result = 'w'; return; }
    if ((st.checks.b || 0) >= 3) { st.status = 'three-check'; st.result = 'b'; return; }
  }

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

/* ── AI (single-player vs computer) ──────────────────────────── */
function evaluatePosition(st) {
  // Material score from the perspective of the side to move (centipawns-ish).
  let score = 0;
  const total = st.width * st.height;
  for (let i = 0; i < total; i++) {
    const p = st.board[i];
    if (!p) continue;
    const v = (VALUE[p.type] || 0) * 100;
    score += (p.color === st.turn) ? v : -v;
  }
  // Crazyhouse: pocket pieces are valuable too (slightly discounted)
  if (st.pockets) {
    const enemy = st.turn === 'w' ? 'b' : 'w';
    for (const t of st.pockets[st.turn]) score += (VALUE[t] || 0) * 80;
    for (const t of st.pockets[enemy])   score -= (VALUE[t] || 0) * 80;
  }
  // King of the Hill: reward kings closer to the center (Chebyshev distance)
  if (st.gameMode === 'kingOfTheHill') {
    const W = st.width, H = st.height;
    const cf = (W - 1) / 2, cr = (H - 1) / 2;
    const maxD = Math.max(cf, cr);
    const distFromCenter = (idx) => {
      const f = idx % W, r = Math.floor(idx / W);
      return Math.max(Math.abs(f - cf), Math.abs(r - cr));
    };
    const enemy = st.turn === 'w' ? 'b' : 'w';
    const myK    = findKing(st, st.turn);
    const oppK   = findKing(st, enemy);
    if (myK  >= 0) score += Math.round((maxD - distFromCenter(myK))  * 80);
    if (oppK >= 0) score -= Math.round((maxD - distFromCenter(oppK)) * 80);
  }
  return score;
}

function isOnHill(st, idx) {
  const W = st.width, H = st.height;
  const f = idx % W, r = Math.floor(idx / W);
  const cfs = [Math.floor((W - 1) / 2), Math.ceil((W - 1) / 2)];
  const crs = [Math.floor((H - 1) / 2), Math.ceil((H - 1) / 2)];
  return cfs.includes(f) && crs.includes(r);
}

function negamax(st, depth, alpha, beta) {
  // Mode-specific terminal positions reach here mid-search (no need for
  // refreshStatus). Score from the side-to-move's perspective.
  if (st.gameMode === 'kingOfTheHill') {
    const prev = st.turn === 'w' ? 'b' : 'w';
    const k = findKing(st, prev);
    if (k >= 0 && isOnHill(st, k)) return -1000000 + (10 - depth);
  }
  if (st.gameMode === 'threeCheck' && st.checks) {
    const wWon = (st.checks.w || 0) >= 3;
    const bWon = (st.checks.b || 0) >= 3;
    if (wWon || bWon) {
      const winner = wWon ? 'w' : 'b';
      return (st.turn === winner ? 1 : -1) * (1000000 - (10 - depth));
    }
  }

  const moves = allLegalMoves(st);
  if (moves.length === 0) {
    const enemy = st.turn === 'w' ? 'b' : 'w';
    const inCheck = isAttacked(st, findKing(st, st.turn), enemy);
    if (inCheck) return -1000000 + (10 - depth);   // checkmate (prefer faster)
    return 0;                                      // stalemate
  }
  if (depth <= 0) return evaluatePosition(st);

  // Captures first → better alpha-beta pruning
  moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

  let best = -Infinity;
  for (const mv of moves) {
    const next = cloneState(st);
    applyMoveTo(next, mv);
    const score = -negamax(next, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function chooseAiMove(st, depth) {
  const legal = allLegalMoves(st);
  if (legal.length === 0) return null;
  // Shuffle for variety on equal-scored moves
  const moves = legal.slice();
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  let bestMove  = moves[0];
  let bestScore = -Infinity;
  for (const mv of moves) {
    const next = cloneState(st);
    applyMoveTo(next, mv);
    const score = -negamax(next, depth - 1, -1e9, 1e9);
    if (score > bestScore) {
      bestScore = score;
      bestMove  = mv;
    }
  }
  return bestMove;
}

function isAiTurn() {
  if (mode !== 'single' || !state || isGameOver()) return false;
  if (!currentConfig || currentConfig.opponent !== 'ai') return false;
  return state.turn !== currentConfig.playerColor;
}

function maybeTriggerAi() {
  if (!isAiTurn()) return;
  if (aiTimer) clearTimeout(aiTimer);
  // Brief delay so the human sees their move land before the AI replies.
  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (!isAiTurn()) return;
    // Power-Ups: try to spend a token first
    const puMv = chooseAiPowerUpMove();
    if (puMv) { finalizeMove(puMv); return; }
    const depth = currentConfig.aiDifficulty || 2;
    const mv = chooseAiMove(state, depth);
    if (mv) finalizeMove(mv);
  }, 300);
}

// Picks a power-up move using simple heuristics. Returns null if the AI
// should just play a regular chess move instead.
function chooseAiPowerUpMove() {
  if (!state || !state.powerUps) return null;
  const me = state.turn;
  const tokens = state.powerUps[me] || [];
  if (!tokens.length) return null;
  // Random skip so the AI sometimes saves tokens for later
  if (Math.random() < 0.35) return null;

  const W = state.width, H = state.height, total = W * H;
  const enemy = me === 'w' ? 'b' : 'w';

  // 1. Promote — best if AI has a pawn close to the back rank
  if (tokens.includes('promote')) {
    let bestPawn = -1, bestAdvance = -1;
    for (let i = 0; i < total; i++) {
      const p = state.board[i];
      if (!p || p.color !== me || p.type !== 'p') continue;
      const r = Math.floor(i / W);
      const advance = me === 'w' ? (H - 1 - r) : r;   // higher = more advanced
      if (advance > bestAdvance) { bestAdvance = advance; bestPawn = i; }
    }
    // Use it when the pawn is at least past its own half of the board
    if (bestPawn >= 0 && bestAdvance >= Math.floor(H / 2) - 1) {
      return { from: -1, to: bestPawn, powerUp: 'promote', promo: 'q' };
    }
  }

  // 2. Randomize — gamble against the opponent's most valuable piece
  if (tokens.includes('randomize')) {
    let bestEnemy = -1, bestVal = 0;
    for (let i = 0; i < total; i++) {
      const p = state.board[i];
      if (!p || p.color !== enemy || p.type === 'k') continue;
      const v = VALUE[p.type] || 0;
      if (v > bestVal) { bestVal = v; bestEnemy = i; }
    }
    if (bestEnemy >= 0 && bestVal >= 5) { // queen or rook only
      const choices = ['q','r','b','n','p'];
      const newType = choices[Math.floor(Math.random() * choices.length)];
      return { from: -1, to: bestEnemy, powerUp: 'randomize', newType };
    }
  }

  // 3. Teleport — rescue an own valuable piece that's currently attacked
  if (tokens.includes('teleport')) {
    let threatenedIdx = -1, threatenedVal = 0;
    for (let i = 0; i < total; i++) {
      const p = state.board[i];
      if (!p || p.color !== me || p.type === 'k') continue;
      if (!isAttacked(state, i, enemy)) continue;
      const v = VALUE[p.type] || 0;
      if (v > threatenedVal) { threatenedVal = v; threatenedIdx = i; }
    }
    if (threatenedIdx >= 0 && threatenedVal >= 3) {  // worth saving
      const safe = [];
      for (let i = 0; i < total; i++) {
        if (state.board[i]) continue;
        if (!isAttacked(state, i, enemy)) safe.push(i);
      }
      if (safe.length) {
        const dst = safe[Math.floor(Math.random() * safe.length)];
        return { from: threatenedIdx, to: dst, powerUp: 'teleport' };
      }
    }
  }

  return null;
}

function cancelAi() {
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
}

/* ── Standard Algebraic Notation ─────────────────────────────── */
function moveToSAN(stBefore, mv) {
  if (mv.powerUp) {
    if (mv.powerUp === 'promote')   return `[↑${(mv.promo || 'q').toUpperCase()} ${squareName(stBefore, mv.to)}]`;
    if (mv.powerUp === 'teleport')  return `[⇄ ${squareName(stBefore, mv.from)}→${squareName(stBefore, mv.to)}]`;
    if (mv.powerUp === 'randomize') return `[? ${squareName(stBefore, mv.to)}=${(mv.newType || '?').toUpperCase()}]`;
  }
  if (mv.drop) {
    const letter = mv.drop === 'p' ? 'P' : mv.drop.toUpperCase();
    return appendCheckSuffix(stBefore, mv, letter + '@' + squareName(stBefore, mv.to));
  }
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

// Default sound URLs used when a piece has no custom sound for that event.
const DEFAULT_PIECE_SOUNDS = {
  moveSound: 'https://cdn.freesound.org/previews/351/351518_4502687-hq.mp3',
  killSound: 'https://cdn.freesound.org/previews/30/30248_56897-hq.mp3',
  dieSound:  'https://cdn.freesound.org/previews/566/566453_5409451-hq.mp3',
};

function playPieceSound(type, kind) {
  let url;
  const piece = state && state.custom && state.custom.pieces && state.custom.pieces[type];
  if (piece) {
    url = piece[kind];
    // Backward compat: legacy presets stored the kill sound as `sound`.
    if (!url && kind === 'killSound') url = piece.sound;
  }
  // Fall back to the default piece sound when no custom URL is set.
  if (!url) url = DEFAULT_PIECE_SOUNDS[kind];
  if (!url) return;
  try {
    const audio = new Audio(url);
    audio.volume = sfxVolumeNorm();
    audio.play().catch(() => {});
  } catch (e) {}
}

/* ── UI rendering ────────────────────────────────────────────── */
function isGameOver() {
  return state && (
    state.status === 'checkmate' ||
    state.status === 'stalemate' ||
    state.status === 'draw' ||
    state.status === 'timeout' ||
    state.status === 'koth-win' ||
    state.status === 'three-check'
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

  // Pre-compute the King-of-the-Hill center squares so we can highlight them
  let hillSet = null;
  if (state.gameMode === 'kingOfTheHill') {
    hillSet = new Set();
    const cf = [Math.floor((W - 1) / 2), Math.ceil((W - 1) / 2)];
    const cr = [Math.floor((H - 1) / 2), Math.ceil((H - 1) / 2)];
    for (const f of cf) for (const r of cr) hillSet.add(r * W + f);
  }

  for (const idx of order) {
    const f = fileOf(state, idx), r = rankOf(state, idx);
    const isLight = (f + r) % 2 === 0;
    const sq = document.createElement('button');
    sq.type = 'button';
    sq.className = 'sq ' + (isLight ? 'sq--light' : 'sq--dark');
    if (hillSet && hillSet.has(idx)) sq.classList.add('sq--hill');
    sq.dataset.i = idx;
    sq.setAttribute('aria-label', squareName(state, idx));

    if (lastMove && (lastMove.from === idx || lastMove.to === idx)) sq.classList.add('sq--last');
    if (selected === idx) sq.classList.add('sq--sel');
    if (activePowerUp && activePowerUp.sourceIdx === idx) sq.classList.add('sq--sel');
    if (idx === inCheckIdx) sq.classList.add('sq--check');

    // King fall on checkmate — animate within first 1.5s, lock pose afterwards
    if (state.status === 'checkmate' && idx === inCheckIdx) {
      const recent = endedAt && (Date.now() - endedAt) < 1500;
      sq.classList.add(recent ? 'sq--king-fallen' : 'sq--king-fallen-done');
    }

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

  // Profile badges. In single-player both seats are you; in online, the local
  // player's seat shows your profile and the other shows the opponent's.
  const topIsLocal = (mode === 'single') || (myColor === topColor);
  const botIsLocal = (mode === 'single') || (myColor === botColor);
  applyProfileToTag(profilePicTop, profileNameTop, topIsLocal ? profile : opponentProfile);
  applyProfileToTag(profilePicBot, profileNameBot, botIsLocal ? profile : opponentProfile);
}

function applyProfileToTag(picEl, nameEl, prof) {
  if (prof && prof.picUrl) {
    picEl.src = prof.picUrl;
    picEl.hidden = false;
    picEl.onerror = () => { picEl.hidden = true; };
  } else {
    picEl.hidden = true;
    picEl.removeAttribute('src');
  }
  if (prof && prof.name) {
    nameEl.textContent = prof.name;
    nameEl.hidden = false;
  } else {
    nameEl.textContent = '';
    nameEl.hidden = true;
  }
}

function renderCaptures() {
  const topColor = flipped ? 'w' : 'b';
  const botColor = flipped ? 'b' : 'w';
  if (state.pockets) {
    // Crazyhouse: each capture row shows that side's drop-able pocket pieces
    captureTop.innerHTML    = formatPocket(state.pockets[topColor], topColor);
    captureBottom.innerHTML = formatPocket(state.pockets[botColor], botColor);
  } else {
    captureTop.innerHTML    = formatCaptures(state.captured[topColor]);
    captureBottom.innerHTML = formatCaptures(state.captured[botColor]);
  }
}

function formatCaptures(list) {
  return list.slice()
    .sort((a, b) => VALUE[b.type] - VALUE[a.type])
    .map(p => `<span class="cap cap--${p.color}">${PIECE_CHAR[p.type]}</span>`)
    .join('');
}

function formatPocket(pocket, color) {
  if (!pocket || !pocket.length) return '';
  const counts = {};
  for (const t of pocket) counts[t] = (counts[t] || 0) + 1;
  const types = Object.keys(counts).sort((a, b) => (VALUE[b] || 0) - (VALUE[a] || 0));
  return types.map(t => {
    const sup    = counts[t] > 1 ? `<sup>${counts[t]}</sup>` : '';
    const isSel  = (selectedDrop === t && state.turn === color);
    const cls    = `cap cap--${color} pocket-piece` + (isSel ? ' pocket-piece--selected' : '');
    return `<span class="${cls}" data-drop-type="${t}" data-drop-color="${color}">${PIECE_CHAR[t]}${sup}</span>`;
  }).join('');
}

function onPocketClick(e) {
  const target = e.target.closest('.pocket-piece');
  if (!target || !state || !state.pockets) return;
  if (isGameOver() || pendingPromo) return;
  const color = target.dataset.dropColor;
  const type  = target.dataset.dropType;
  if (color !== state.turn) return;  // can only drop own pieces
  if (mode !== 'single' && state.turn !== myColor) return;
  if (mode === 'single' && currentConfig && currentConfig.opponent === 'ai'
      && state.turn !== currentConfig.playerColor) return;
  selectPocketPiece(type);
}

function selectPocketPiece(type) {
  if (selectedDrop === type) {
    selectedDrop = null;
    legalForSelected = [];
  } else {
    selectedDrop = type;
    selected = null;
    const candidates = dropMoves(state).filter(m => m.drop === type);
    const enemy = state.turn === 'w' ? 'b' : 'w';
    legalForSelected = candidates.filter(mv => {
      const test = cloneState(state);
      applyMoveTo(test, mv);
      const k = findKing(test, state.turn);
      return k >= 0 && !isAttacked(test, k, enemy);
    });
  }
  render();
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
  } else if (state.status === 'koth-win') {
    text = `${COLOR_NAME[state.result]} reached the center — wins!`;
    kind = 'good';
  } else if (state.status === 'three-check') {
    text = `${COLOR_NAME[state.result]} delivered 3 checks — wins!`;
    kind = 'good';
  } else if (state.status === 'check') {
    text = `${COLOR_NAME[state.turn]} to move — check!`;
    kind = 'bad';
  } else if (isAiTurn()) {
    text = 'AI is thinking…';
    kind = 'neutral';
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
  renderPowerUps();
  renderClocks();
  renderStatus();
  renderHistory();
  renderActionButton();
}

function renderPowerUps() {
  if (!state.powerUps) {
    powerupRowTop.hidden = true;
    powerupRowBot.hidden = true;
    return;
  }
  powerupRowTop.hidden = false;
  powerupRowBot.hidden = false;
  const topColor = flipped ? 'w' : 'b';
  const botColor = flipped ? 'b' : 'w';
  powerupRowTop.innerHTML = formatPowerUps(topColor);
  powerupRowBot.innerHTML = formatPowerUps(botColor);
}

function isLocalSide(color) {
  if (mode === 'single') {
    if (currentConfig && currentConfig.opponent === 'ai') return color === currentConfig.playerColor;
    return color === state.turn;
  }
  return color === myColor;
}

function formatPowerUps(color) {
  const list = (state.powerUps && state.powerUps[color]) || [];
  if (!list.length) return '';
  const mine = isLocalSide(color) && state.turn === color && !isGameOver();
  return list.map((type, i) => {
    const sel = activePowerUp && activePowerUp.color === color && activePowerUp.idx === i;
    let cls = `powerup powerup--${type}`;
    if (mine) cls += ' powerup--mine';
    if (sel)  cls += ' powerup--selected';
    return `<button type="button" class="${cls}" data-pu-color="${color}" data-pu-idx="${i}" data-pu-type="${type}" title="${POWER_UP_NAMES[type]}">${POWER_UP_SYMBOLS[type]}</button>`;
  }).join('');
}

function onPowerUpClick(e) {
  const target = e.target.closest('.powerup');
  if (!target || !state || !state.powerUps) return;
  if (isGameOver() || pendingPromo) return;
  const color = target.dataset.puColor;
  const type  = target.dataset.puType;
  const idx   = parseInt(target.dataset.puIdx, 10);
  if (color !== state.turn) return;
  if (!isLocalSide(color)) return;

  // Toggle: clicking the active token cancels
  if (activePowerUp && activePowerUp.color === color && activePowerUp.idx === idx) {
    activePowerUp = null;
    legalForSelected = [];
  } else {
    activePowerUp = { type, color, idx, step: 'select-source' };
    selected = null;
    selectedDrop = null;
    legalForSelected = [];
  }
  render();
}

function handlePowerUpClick(idx) {
  if (!activePowerUp) return false;
  const piece = state.board[idx];

  if (activePowerUp.type === 'promote') {
    // Promote can only target your own pawns
    if (!piece || piece.color !== state.turn || piece.type !== 'p') return true;
    pendingPromo = ['q','r','b','n'].map(promo => ({
      from: -1, to: idx, powerUp: 'promote', promo,
    }));
    promoModal.hidden = false;
    return true;
  }

  if (activePowerUp.type === 'teleport') {
    if (activePowerUp.step === 'select-source') {
      if (!piece || piece.color !== state.turn) return true;
      activePowerUp.sourceIdx = idx;
      activePowerUp.step = 'select-target';
      legalForSelected = [];
      const total = state.width * state.height;
      for (let i = 0; i < total; i++) {
        if (!state.board[i]) {
          legalForSelected.push({ from: idx, to: i, powerUp: 'teleport' });
        }
      }
      render();
      return true;
    }
    // step === 'select-target'
    const mv = legalForSelected.find(m => m.to === idx);
    if (mv) {
      activePowerUp = null;
      commitMove(mv);
    }
    return true;
  }

  if (activePowerUp.type === 'randomize') {
    if (!piece || piece.type === 'k') return true;
    const choices = ['q','r','b','n','p'];
    const newType = choices[Math.floor(Math.random() * choices.length)];
    const mv = { from: -1, to: idx, powerUp: 'randomize', newType };
    activePowerUp = null;
    commitMove(mv);
    return true;
  }

  return false;
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
  // Single-vs-AI: only allow interaction on the human's turn
  if (mode === 'single' && currentConfig && currentConfig.opponent === 'ai'
      && state.turn !== currentConfig.playerColor) return;

  // Power-Ups: route the click through the power-up handler
  if (activePowerUp) {
    handlePowerUpClick(idx);
    return;
  }

  // Crazyhouse: handle drop completion
  if (selectedDrop !== null) {
    const mv = legalForSelected.find(m => m.to === idx && m.drop);
    if (mv) {
      selectedDrop = null;
      commitMove(mv);
      return;
    }
    // Click somewhere else: cancel drop and fall through
    selectedDrop = null;
    legalForSelected = [];
    render();
  }

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
  selectedDrop = null;
  activePowerUp = null;
  legalForSelected = [];

  // Power-Ups: grant the mover at most ONE token per turn — capture wins,
  // else the periodic grant (every 6 plies) fires.
  if (state.gameMode === 'powerUps' && state.powerUps) {
    if (mv.capture) {
      state.powerUps[moverColor].push(randomPowerUpType());
    } else if (state.moves.length > 0 && state.moves.length % 6 === 0) {
      state.powerUps[moverColor].push(randomPowerUpType());
    }
  }

  let victimType = null;
  if (mv.capture) {
    const captures = state.captured[moverColor];
    const victim = captures[captures.length - 1];
    if (victim) victimType = victim.type;
    state.lastCaptureBy = moverColor;
    // Crazyhouse: captured piece joins the capturer's pocket as their colour
    if (state.pockets) state.pockets[moverColor].push(victim.type);
  }
  // Three-Check: if this move delivers check, increment the mover's tally
  if (state.gameMode === 'threeCheck' && state.checks) {
    const opp = state.turn; // applyMoveTo flipped turn — `opp` is the side now to move
    const enemyOfOpp = opp === 'w' ? 'b' : 'w';
    if (isAttacked(state, findKing(state, opp), enemyOfOpp)) {
      state.checks[enemyOfOpp]++;
    }
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

  // Music transitions
  if (mv.capture && !isGameOver()) {
    transitionToBattle();
    refreshBattleMusic();   // swap to new capturer's URL if it changed
  }
  if (isGameOver()) transitionToMenu();

  // Victory sound for the winner (heard on both sides via shared profile URL)
  maybePlayVictory();

  // Big end-of-game overlay
  maybeShowEndBanner();

  // Online: host broadcasts the result so the guest stays in sync
  if (mode === 'host' && conn && conn.open) {
    try { conn.send({ type: 'state', state, mv, moverType, victimType }); } catch (e) {}
  }

  render();

  // If it's now the AI's turn, queue its reply
  maybeTriggerAi();
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
  cancelAi();
  state = undoStack.pop();
  // In single-vs-AI: keep popping past the AI's reply so we land on the
  // human's turn instead of immediately handing it back to the AI.
  if (mode === 'single' && currentConfig && currentConfig.opponent === 'ai') {
    if (state.turn !== currentConfig.playerColor && undoStack.length) {
      state = undoStack.pop();
    }
  }
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
    cancelAi();
    hideEndBanner();
    transitionToMenu();
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
  setMode('single');
  hideEndBanner();
  transitionToMenu();
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
    gameMode: gameModeSelect.value || 'standard',
    useCustomPieces: useCustomPieces.checked,
    hostColor:  hostColorSelect.value === 'b' ? 'b' : 'w',
    shareMusic: shareMusicEl.checked,
    opponent:    aiOpponentSelect.value === 'ai' ? 'ai' : 'self',
    playerColor: aiPlayerColorSelect.value === 'b' ? 'b' : 'w',
    aiDifficulty: Math.max(1, Math.min(3, parseInt(aiDifficultySelect.value) || 2)),
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
  hostColorSelect.value = cfg.hostColor === 'b' ? 'b' : 'w';
  shareMusicEl.checked  = cfg.shareMusic !== false;
  gameModeSelect.value  = cfg.gameMode || 'standard';
  aiOpponentSelect.value    = cfg.opponent === 'ai' ? 'ai' : 'self';
  aiPlayerColorSelect.value = cfg.playerColor === 'b' ? 'b' : 'w';
  aiDifficultySelect.value  = String(cfg.aiDifficulty || 2);
  updateTimeFieldsVisibility();
  updateAiOptionsVisibility();
  updateBoardSizeAvailability();
}

function updateAiOptionsVisibility() {
  const showAi = aiOpponentSelect.value === 'ai';
  document.querySelectorAll('.ai-only').forEach(el => { el.hidden = !showAi; });
}

aiOpponentSelect.addEventListener('change', updateAiOptionsVisibility);

function updateBoardSizeAvailability() {
  const sixRadio   = document.querySelector('input[name="boardSize"][value="6"]');
  const eightRadio = document.querySelector('input[name="boardSize"][value="8"]');
  if (!sixRadio || !eightRadio) return;
  // King of the Hill only makes sense on 8×8 (the 6×6 mini board has no
  // bishops, so the central-square race is too constrained).
  if (gameModeSelect.value === 'kingOfTheHill') {
    if (sixRadio.checked) eightRadio.checked = true;
    sixRadio.disabled = true;
    sixRadio.parentElement.classList.add('radio--disabled');
  } else {
    sixRadio.disabled = false;
    sixRadio.parentElement.classList.remove('radio--disabled');
  }
}

gameModeSelect.addEventListener('change', updateBoardSizeAvailability);

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

function updateHostOnlyVisibility() {
  document.querySelectorAll('.host-only').forEach(el => {
    el.hidden = (mode !== 'host');
  });
}

function updateSingleOnlyVisibility() {
  document.querySelectorAll('.single-only').forEach(el => {
    el.hidden = (mode !== 'single');
  });
}

function setMode(newMode) {
  mode = newMode;
  updateStartGameButton();
  updateHostOnlyVisibility();
  updateSingleOnlyVisibility();
}

btnSinglePlayer.addEventListener('click', () => {
  setMode('single');
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
    setMode('single');
    showScreen('online');
  } else {
    setMode('single');
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
  selectedDrop = null;
  activePowerUp = null;
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

  if (mode !== 'single') flipped = (myColor === 'b');

  resetVote();
  lastResultPlayed = null;
  hideEndBanner();
  transitionToMenu();
  cancelAi();
  showScreen('game');
  render();
  // If the AI is configured to play first (e.g. AI is white), trigger it now
  maybeTriggerAi();

  // Online host: bring the guest to the same starting state
  if (mode === 'host' && conn && conn.open) {
    try {
      conn.send({
        type: 'welcome',
        yourColor: myColor === 'w' ? 'b' : 'w',
        matchCfg: cfg,
        customCfg: customCfg,
        state: state,
        hostProfile: getMyShareableProfile(),
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
// In-memory copy of all six pieces' settings (only one shown at a time)
let customDraft     = blankCustom();
let currentPieceIdx = 0;

const pieceEditorIcon    = $('pieceEditorIcon');
const pieceEditorName    = $('pieceEditorName');
const pieceEditorCounter = $('pieceEditorCounter');
const pieceFieldEls = {
  wImg:      $('pieceWImg'),
  bImg:      $('pieceBImg'),
  moveSound: $('pieceMoveSound'),
  killSound: $('pieceKillSound'),
  dieSound:  $('pieceDieSound'),
  movement:  $('pieceMovement'),
  attack:    $('pieceAttack'),
};

function buildPieceEditor() {
  // Populate the movement <select> with the standard pattern list
  const moveSel = pieceFieldEls.movement;
  moveSel.innerHTML = '';
  for (const o of MOVEMENT_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = (o.value === 'none') ? 'None — cannot move' : o.label;
    moveSel.appendChild(opt);
  }
  // Populate the attack <select> with the same options
  const attackSel = pieceFieldEls.attack;
  attackSel.innerHTML = '';
  for (const o of MOVEMENT_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = o.value;
    if (o.value === 'default')   opt.textContent = 'Default (same as movement)';
    else if (o.value === 'none') opt.textContent = 'None — cannot capture';
    else                          opt.textContent = o.label;
    attackSel.appendChild(opt);
  }
  $('pieceNavPrev').addEventListener('click', () => switchPiece(-1));
  $('pieceNavNext').addEventListener('click', () => switchPiece( 1));
}

function switchPiece(delta) {
  // Capture current edits before swapping
  saveCurrentPieceFromEditor();
  const n = PIECE_TYPES.length;
  currentPieceIdx = (currentPieceIdx + delta + n) % n;
  loadCurrentPieceIntoEditor();
}

function loadCurrentPieceIntoEditor() {
  const t = PIECE_TYPES[currentPieceIdx];
  const blank = blankCustom().pieces[t];
  const p = (customDraft.pieces && customDraft.pieces[t]) || blank;
  pieceEditorIcon.textContent    = PIECE_CHAR[t];
  pieceEditorName.textContent    = PIECE_NAMES[t];
  pieceEditorCounter.textContent = `${currentPieceIdx + 1} / ${PIECE_TYPES.length}`;
  pieceFieldEls.wImg.value      = p.wImg || '';
  pieceFieldEls.bImg.value      = p.bImg || '';
  pieceFieldEls.moveSound.value = p.moveSound || '';
  // Migrate legacy `sound` → killSound on display
  pieceFieldEls.killSound.value = p.killSound || p.sound || '';
  pieceFieldEls.dieSound.value  = p.dieSound  || '';
  pieceFieldEls.movement.value  = p.movement  || 'default';
  pieceFieldEls.attack.value    = p.attack    || 'default';
}

function saveCurrentPieceFromEditor() {
  const t = PIECE_TYPES[currentPieceIdx];
  if (!customDraft.pieces) customDraft.pieces = {};
  if (!customDraft.pieces[t]) customDraft.pieces[t] = blankCustom().pieces[t];
  const p = customDraft.pieces[t];
  p.wImg      = (pieceFieldEls.wImg.value      || '').trim();
  p.bImg      = (pieceFieldEls.bImg.value      || '').trim();
  p.moveSound = (pieceFieldEls.moveSound.value || '').trim();
  p.killSound = (pieceFieldEls.killSound.value || '').trim();
  p.dieSound  = (pieceFieldEls.dieSound.value  || '').trim();
  p.movement  = pieceFieldEls.movement.value || 'default';
  p.attack    = pieceFieldEls.attack.value   || 'default';
  delete p.sound;
}

function readCustomFromForm() {
  saveCurrentPieceFromEditor();
  return JSON.parse(JSON.stringify(customDraft));
}

function writeCustomToForm(custom) {
  const cust = (custom && custom.pieces) ? JSON.parse(JSON.stringify(custom)) : blankCustom();
  // Migrate legacy `sound` field on every piece
  for (const t of PIECE_TYPES) {
    const p = cust.pieces[t];
    if (p && p.sound && !p.killSound) p.killSound = p.sound;
  }
  customDraft = cust;
  currentPieceIdx = 0;
  loadCurrentPieceIntoEditor();
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
  intentionalLeave = true;
  if (conn) { try { conn.close(); } catch (_) {} conn = null; }
  if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
  myColor = null;
  opponentProfile = null;
  // Reset shortly after the close handler has had a chance to fire
  setTimeout(() => { intentionalLeave = false; }, 200);
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
      playOneShot(LOBBY_JOIN_SOUND);
      myColor = (matchCfg.hostColor === 'b') ? 'b' : 'w';
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
      playOneShot(LOBBY_JOIN_SOUND);
    });
    c.on('data', (msg) => handleGuestMessage(msg));
    c.on('close', () => onConnClosed());
    c.on('error', (e) => console.warn('[Guest conn] error:', e));
  });
}

function onConnClosed() {
  conn = null;
  if (!intentionalLeave) playOneShot(LOBBY_LEAVE_SOUND);
  if (state) {
    gameStatus.textContent = 'Opponent disconnected.';
    gameStatus.className = 'status status--warn';
    stopClockTick();
    transitionToMenu();
    if (!bannerShownForEnd) {
      endedAt = Date.now();
      showEndBanner('⚠', 'Opponent Left', 'Connection lost');
    }
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
  } else if (msg.type === 'profile') {
    if (msg.profile) {
      opponentProfile = msg.profile;
      applyMusicProfile();
      if (state) render();
    }
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
    if (msg.hostProfile) opponentProfile = msg.hostProfile;
    // Send our own profile back so the host can render it
    if (conn && conn.open) {
      try { conn.send({ type: 'profile', profile: getMyShareableProfile() }); } catch (e) {}
    }
    applyMusicProfile();
    undoStack = [];
    selected = null;
    selectedDrop = null;
    activePowerUp = null;
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
    lastResultPlayed = null;
    hideEndBanner();
    transitionToMenu();
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
    selectedDrop = null;
    activePowerUp = null;
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
    if (msg.mv && msg.mv.capture && !isGameOver()) {
      transitionToBattle();
      refreshBattleMusic();
    }
    if (isGameOver()) transitionToMenu();
    maybePlayVictory();
    maybeShowEndBanner();
    render();
    return;
  }
  if (msg.type === 'vote') {
    receiveVote(msg.kind, msg.vote);
    return;
  }
  if (msg.type === 'profile') {
    if (msg.profile) {
      opponentProfile = msg.profile;
      applyMusicProfile();
      if (state) render();
    }
    return;
  }
}

/* ── Online navigation ─────────────────────────────────────── */
btnOnlineBack.addEventListener('click', () => {
  teardownConnection();
  setMode('single');
  showScreen('title');
});

btnHostLobby.addEventListener('click', () => {
  if (typeof Peer === 'undefined') {
    setOnlineStatus(onlineStatus, 'PeerJS failed to load — reload the page.', 'bad');
    return;
  }
  setMode('host');
  showScreen('menu');
});

btnJoinLobby.addEventListener('click', () => {
  if (typeof Peer === 'undefined') {
    setOnlineStatus(onlineStatus, 'PeerJS failed to load — reload the page.', 'bad');
    return;
  }
  setMode('guest');
  joinCodeEl.value = '';
  setOnlineStatus(joinStatus, '', 'neutral');
  btnJoinConnect.disabled = false;
  showScreen('join');
});

btnHostCancel.addEventListener('click', () => {
  teardownConnection();
  setMode('single');
  showScreen('online');
});

btnJoinBack.addEventListener('click', () => {
  teardownConnection();
  setMode('single');
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

/* ── Profile ─────────────────────────────────────────────────── */
function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate legacy single `volume` → split SFX + music
      if (parsed.volume != null) {
        if (parsed.sfxVolume   == null) parsed.sfxVolume   = parsed.volume;
        if (parsed.musicVolume == null) parsed.musicVolume = parsed.volume;
        delete parsed.volume;
      }
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch (e) {}
  return { ...DEFAULT_PROFILE };
}

function persistProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) {}
}

function getMyShareableProfile() {
  return {
    name:        profile.name || 'Player',
    picUrl:      profile.picUrl || '',
    victoryUrl:  profile.victoryUrl || '',
    menuMusic:   profile.menuMusic || '',
    battleMusic: profile.battleMusic || '',
  };
}

function applyProfileBackground() {
  document.body.style.background = '';
  if (profile.bgMode === 'color' && profile.bgColor) {
    document.body.style.background = profile.bgColor;
  } else if (profile.bgMode === 'image' && profile.bgImage) {
    const safe = profile.bgImage.replace(/"/g, '%22');
    document.body.style.background =
      `url("${safe}") center/cover fixed no-repeat, var(--color-bg)`;
  }
}

function readProfileFromForm() {
  return {
    name:        (profileName.value || '').trim() || 'Player',
    picUrl:      (profilePicUrl.value || '').trim(),
    sfxVolume:   Math.max(0, Math.min(100, parseInt(profileSfxVolume.value)   || 0)),
    musicVolume: Math.max(0, Math.min(100, parseInt(profileMusicVolume.value) || 0)),
    bgMode:      document.querySelector('input[name="bgMode"]:checked').value,
    bgColor:     profileBgColor.value,
    bgImage:     (profileBgImage.value || '').trim(),
    menuMusic:   (profileMenuMusic.value || '').trim(),
    battleMusic: (profileBattleMusic.value || '').trim(),
    victoryUrl:  (profileVictory.value || '').trim(),
  };
}

function writeProfileToForm(p) {
  profileName.value        = p.name || '';
  profilePicUrl.value      = p.picUrl || '';
  profileSfxVolume.value   = (p.sfxVolume   != null) ? p.sfxVolume
                             : (p.volume != null ? p.volume : 85);
  profileMusicVolume.value = (p.musicVolume != null) ? p.musicVolume
                             : (p.volume != null ? p.volume : 60);
  sfxVolumeDisplay.textContent   = profileSfxVolume.value + '%';
  musicVolumeDisplay.textContent = profileMusicVolume.value + '%';
  const radio = document.querySelector(`input[name="bgMode"][value="${p.bgMode || 'default'}"]`);
  if (radio) radio.checked = true;
  profileBgColor.value     = p.bgColor || '#1c130b';
  profileBgImage.value     = p.bgImage || '';
  profileMenuMusic.value   = p.menuMusic || '';
  profileBattleMusic.value = p.battleMusic || '';
  profileVictory.value     = p.victoryUrl || '';
  updateBgVisibility();
  updatePicPreview();
}

function updatePicPreview() {
  const url = (profilePicUrl.value || '').trim();
  if (!url) {
    profilePicPreview.hidden = true;
    profilePicPreview.removeAttribute('src');
    return;
  }
  profilePicPreview.onerror = () => { profilePicPreview.hidden = true; };
  profilePicPreview.onload  = () => { profilePicPreview.hidden = false; };
  profilePicPreview.src = url;
}

function updateBgVisibility() {
  const m = document.querySelector('input[name="bgMode"]:checked').value;
  bgColorWrap.hidden    = (m !== 'color');
  profileBgImage.hidden = (m !== 'image');
}

profileSfxVolume.addEventListener('input', () => {
  sfxVolumeDisplay.textContent = profileSfxVolume.value + '%';
});
profileMusicVolume.addEventListener('input', () => {
  musicVolumeDisplay.textContent = profileMusicVolume.value + '%';
});

profilePicUrl.addEventListener('input', updatePicPreview);

document.querySelectorAll('input[name="bgMode"]').forEach(el =>
  el.addEventListener('change', updateBgVisibility)
);

btnProfile.addEventListener('click', () => {
  writeProfileToForm(profile);
  showScreen('profile');
});

btnProfileBack.addEventListener('click', () => showScreen('title'));

btnSaveProfile.addEventListener('click', () => {
  profile = readProfileFromForm();
  persistProfile();
  applyProfileBackground();
  applyMusicProfile();
  applyMusicVolume();
  // Push name + pic + victory URL to the opponent if a connection is live
  if (mode !== 'single' && conn && conn.open) {
    try { conn.send({ type: 'profile', profile: getMyShareableProfile() }); } catch (e) {}
  }
  if (state) render();
  showScreen('title');
});

btnDefaultProfile.addEventListener('click', () => {
  writeProfileToForm(DEFAULT_PROFILE);
});

/* ── Profile backup (export / import JSON) ──────────────────── */
btnExportProfile.addEventListener('click', () => {
  const data = {
    app:          'custom-chess',
    version:      1,
    exportedAt:   new Date().toISOString(),
    profile:      profile,
    matchPresets: loadPresets(),
    piecePresets: loadCustomPresets(),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const safeName = (profile.name || 'player').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  a.href = url;
  a.download = `custom-chess-profile-${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

btnImportProfile.addEventListener('click', () => {
  profileImportFile.value = '';
  profileImportFile.click();
});

profileImportFile.addEventListener('change', () => {
  const file = profileImportFile.files && profileImportFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object') throw new Error('Not a valid JSON object');

      const summary = [];
      if (data.profile && typeof data.profile === 'object') {
        profile = { ...DEFAULT_PROFILE, ...data.profile };
        persistProfile();
        writeProfileToForm(profile);
        applyProfileBackground();
        applyMusicProfile();
        applyMusicVolume();
        summary.push('profile');
      }
      if (Array.isArray(data.matchPresets)) {
        savePresets(data.matchPresets);
        refreshPresetSelect();
        summary.push(`${data.matchPresets.length} match preset(s)`);
      }
      if (Array.isArray(data.piecePresets)) {
        saveCustomPresets(data.piecePresets);
        refreshCustomPresetSelect();
        summary.push(`${data.piecePresets.length} piece preset(s)`);
      }

      alert(summary.length ? 'Imported: ' + summary.join(', ') + '.' : 'Nothing recognised in this file.');
    } catch (e) {
      alert('Could not import: ' + (e && e.message ? e.message : 'invalid file'));
    } finally {
      profileImportFile.value = '';
    }
  };
  reader.onerror = () => alert('Could not read the file.');
  reader.readAsText(file);
});

/* ── End-of-game banner ─────────────────────────────────────── */
function showEndBanner(icon, title, subtitle) {
  gameBannerIcon.textContent     = icon;
  gameBannerTitle.textContent    = title;
  gameBannerSubtitle.textContent = subtitle;
  gameBanner.hidden = false;
  // Replay banner entry animation by re-triggering reflow
  gameBanner.style.animation = 'none';
  void gameBanner.offsetWidth;
  gameBanner.style.animation = '';
  // Shake the framed board once
  const bw = document.querySelector('.board-wrap');
  if (bw) {
    bw.classList.remove('board-wrap--ended');
    void bw.offsetWidth;
    bw.classList.add('board-wrap--ended');
  }
  bannerShownForEnd = true;
}

function hideEndBanner() {
  gameBanner.hidden = true;
  bannerShownForEnd = false;
  endedAt = null;
  const bw = document.querySelector('.board-wrap');
  if (bw) bw.classList.remove('board-wrap--ended');
}

function maybeShowEndBanner() {
  if (!state || bannerShownForEnd) return;
  if (!isGameOver()) return;
  endedAt = Date.now();
  let icon = '♙', title = 'Game Over', subtitle = '';
  if (state.status === 'checkmate') {
    title    = 'Checkmate';
    subtitle = `${COLOR_NAME[state.result]} wins`;
    icon     = state.result === 'w' ? '♔' : '♚'; // ♔ / ♚
  } else if (state.status === 'stalemate') {
    if (state.result === 'draw') {
      title = 'Stalemate'; subtitle = 'Draw'; icon = '½';
    } else {
      title    = 'Stalemate';
      subtitle = `${COLOR_NAME[state.result]} wins`;
      icon     = state.result === 'w' ? '♔' : '♚';
    }
  } else if (state.status === 'draw') {
    title = 'Draw'; subtitle = '50-move rule'; icon = '½';
  } else if (state.status === 'timeout') {
    title    = 'Time Out';
    subtitle = `${COLOR_NAME[state.result]} wins`;
    icon     = '⧖'; // hourglass-ish
  } else if (state.status === 'koth-win') {
    title    = 'King of the Hill';
    subtitle = `${COLOR_NAME[state.result]} reached the center`;
    icon     = state.result === 'w' ? '♔' : '♚';
  } else if (state.status === 'three-check') {
    title    = 'Three Checks';
    subtitle = `${COLOR_NAME[state.result]} delivered 3 checks`;
    icon     = '✕';
  }
  showEndBanner(icon, title, subtitle);
}

gameBannerClose.addEventListener('click', () => {
  // Just hide; keep bannerShownForEnd so a re-render won't bring it back
  gameBanner.hidden = true;
});

/* ── Music & victory sound ───────────────────────────────────── */
let YT_READY = false;
let ytReadyCallbacks = [];
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) { YT_READY = true; return; }
  window.onYouTubeIframeAPIReady = () => {
    YT_READY = true;
    ytReadyCallbacks.forEach(cb => cb());
    ytReadyCallbacks = [];
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}
function whenYTReady(cb) { if (YT_READY) cb(); else ytReadyCallbacks.push(cb); }

function isYouTubeUrl(url) { return /(?:youtube\.com|youtu\.be)/i.test(url); }
function extractYouTubeId(url) {
  const m1 = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m2) return m2[1];
  const m3 = url.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (m3) return m3[1];
  return null;
}

function createMusicPlayer(containerId) {
  return {
    containerId,
    audio: null,
    yt: null,
    url: '',
    currentVolume: 0,
    isPlaying: false,
    fadeRAF: null,

    setUrl(url) {
      url = (url || '').trim();
      if (url === this.url) return;
      this.destroy();
      this.url = url;
      if (!url) return;
      if (isYouTubeUrl(url)) this._initYT(url);
      else this._initAudio(url);
    },

    _initAudio(url) {
      this.audio = new Audio(url);
      this.audio.loop = true;
      this.audio.volume = this.currentVolume;
    },

    _initYT(url) {
      const id = extractYouTubeId(url);
      if (!id) return;
      this._ensureContainer();
      whenYTReady(() => {
        if (this.url !== url) return;
        try {
          this.yt = new YT.Player(this.containerId, {
            height: '0', width: '0', videoId: id,
            playerVars: {
              autoplay: 0, controls: 0, loop: 1, playlist: id,
              modestbranding: 1, fs: 0, iv_load_policy: 3,
              disablekb: 1, rel: 0,
            },
            events: {
              onReady: () => {
                if (!this.yt) return;
                this.yt.setVolume(Math.round(this.currentVolume * 100));
                if (this.isPlaying) this.yt.playVideo();
              },
              onStateChange: (e) => {
                if (e.data === YT.PlayerState.ENDED) e.target.playVideo();
              },
            },
          });
        } catch (e) {}
      });
    },

    _ensureContainer() {
      let el = document.getElementById(this.containerId);
      if (el) return el;
      const host = document.querySelector('.music-host');
      if (!host) return null;
      el = document.createElement('div');
      el.id = this.containerId;
      host.appendChild(el);
      return el;
    },

    play() {
      this.isPlaying = true;
      if (this.audio) this.audio.play().catch(() => {});
      if (this.yt && this.yt.playVideo) { try { this.yt.playVideo(); } catch (e) {} }
    },

    pause() {
      this.isPlaying = false;
      if (this.audio) this.audio.pause();
      if (this.yt && this.yt.pauseVideo) { try { this.yt.pauseVideo(); } catch (e) {} }
    },

    setVolume(v) {
      this.currentVolume = Math.max(0, Math.min(1, v));
      if (this.audio) this.audio.volume = this.currentVolume;
      if (this.yt && this.yt.setVolume) {
        try { this.yt.setVolume(Math.round(this.currentVolume * 100)); } catch (e) {}
      }
    },

    fadeTo(target, duration, onDone) {
      if (this.fadeRAF) cancelAnimationFrame(this.fadeRAF);
      const from = this.currentVolume;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        this.setVolume(from + (target - from) * t);
        if (t < 1) this.fadeRAF = requestAnimationFrame(tick);
        else { this.fadeRAF = null; if (onDone) onDone(); }
      };
      this.fadeRAF = requestAnimationFrame(tick);
    },

    destroy() {
      if (this.fadeRAF) cancelAnimationFrame(this.fadeRAF);
      this.fadeRAF = null;
      this.isPlaying = false;
      if (this.audio) {
        this.audio.pause();
        this.audio.src = '';
        this.audio = null;
      }
      if (this.yt) {
        try { this.yt.destroy(); } catch (e) {}
        this.yt = null;
        this._ensureContainer();
      }
      this.url = '';
      this.currentVolume = 0;
    },
  };
}

const menuMusic   = createMusicPlayer('menuMusicPlayer');
const battleMusic = createMusicPlayer('battleMusicPlayer');

let musicState       = 'menu';   // 'menu' | 'battle'
let musicInitialized = false;
const FADE_MS        = 6000;

function sfxVolumeNorm() {
  const v = (profile.sfxVolume != null) ? profile.sfxVolume
            : (profile.volume != null ? profile.volume : 85);
  return Math.max(0, Math.min(1, v / 100));
}

function musicVolumeNorm() {
  const v = (profile.musicVolume != null) ? profile.musicVolume
            : (profile.volume != null ? profile.volume : 60);
  return Math.max(0, Math.min(1, v / 100));
}

function shareMusicEnabled() {
  return mode !== 'single' && currentConfig && currentConfig.shareMusic !== false;
}

// Menu URL: own first, fall back to opponent's when sharing is enabled.
function getCurrentMenuUrl() {
  if (mode === 'single' || !shareMusicEnabled()) return profile.menuMusic;
  return profile.menuMusic || (opponentProfile && opponentProfile.menuMusic) || '';
}

// Returns the color that currently has the material lead, or null when tied.
// "Material" = sum of standard piece values (P=1, N=3, B=3, R=5, Q=9) of the
// pieces each side has captured.
function leadingColor() {
  if (!state || !state.captured) return null;
  const score = (list) => (list || []).reduce((s, p) => s + (VALUE[p.type] || 0), 0);
  const w = score(state.captured.w);
  const b = score(state.captured.b);
  if (w === b) return null;
  return w > b ? 'w' : 'b';
}

// Battle URL: when sharing is on, whoever currently has the material lead has
// THEIR battle theme play for both sides. On a tie we keep whatever's already
// playing rather than switching back and forth.
function getCurrentBattleUrl() {
  if (mode === 'single' || !shareMusicEnabled()) return profile.battleMusic;
  const lead = leadingColor();
  if (!lead) {
    return battleMusic.url
        || profile.battleMusic
        || (opponentProfile && opponentProfile.battleMusic)
        || '';
  }
  if (lead === myColor) {
    return profile.battleMusic
        || (opponentProfile && opponentProfile.battleMusic)
        || '';
  }
  return (opponentProfile && opponentProfile.battleMusic)
      || profile.battleMusic
      || '';
}

function startMenuMusicIfNeeded() {
  if (!musicInitialized) {
    musicInitialized = true;
    menuMusic.setUrl(getCurrentMenuUrl());
    battleMusic.setUrl(getCurrentBattleUrl());
  }
  if (!menuMusic.url) return;
  menuMusic.play();
  menuMusic.fadeTo(musicVolumeNorm(), FADE_MS);
}

function transitionToBattle() {
  if (musicState === 'battle') return;
  musicState = 'battle';
  menuMusic.fadeTo(0, FADE_MS, () => menuMusic.pause());
  const url = getCurrentBattleUrl();
  if (url !== battleMusic.url) battleMusic.setUrl(url);
  if (battleMusic.url) {
    battleMusic.play();
    battleMusic.fadeTo(musicVolumeNorm(), FADE_MS);
  }
}

function transitionToMenu() {
  if (musicState === 'menu') return;
  musicState = 'menu';
  battleMusic.fadeTo(0, FADE_MS, () => battleMusic.pause());
  const url = getCurrentMenuUrl();
  if (url !== menuMusic.url) menuMusic.setUrl(url);
  if (menuMusic.url) {
    menuMusic.play();
    menuMusic.fadeTo(musicVolumeNorm(), FADE_MS);
  }
}

// Called after each capture to swap battle music to the new capturer's URL.
function refreshBattleMusic() {
  if (musicState !== 'battle') return;
  const url = getCurrentBattleUrl();
  if (url === battleMusic.url) return;
  battleMusic.fadeTo(0, FADE_MS / 2, () => {
    battleMusic.setUrl(url);
    if (battleMusic.url) {
      battleMusic.play();
      battleMusic.fadeTo(musicVolumeNorm(), FADE_MS / 2);
    }
  });
}

function applyMusicProfile() {
  // Re-evaluate URLs in case the profile or sharing config changed
  if (musicState === 'menu') {
    const url = getCurrentMenuUrl();
    if (url !== menuMusic.url) menuMusic.setUrl(url);
    if (musicInitialized && menuMusic.url) {
      menuMusic.setVolume(musicVolumeNorm());
      menuMusic.play();
    }
  } else if (musicState === 'battle') {
    const url = getCurrentBattleUrl();
    if (url !== battleMusic.url) battleMusic.setUrl(url);
    if (musicInitialized && battleMusic.url) {
      battleMusic.setVolume(musicVolumeNorm());
      battleMusic.play();
    }
  }
}

function applyMusicVolume() {
  const v = musicVolumeNorm();
  if (musicState === 'menu')   menuMusic.setVolume(v);
  if (musicState === 'battle') battleMusic.setVolume(v);
}

// Trigger music start on the very first click (browsers require user gesture)
document.addEventListener('click', () => {
  startMenuMusicIfNeeded();
}, { once: true });

/* ── Victory sound (synced via shared profile) ──────────────── */
let lastResultPlayed = null;

function playOneShot(url) {
  if (!url) return;
  try {
    const a = new Audio(url);
    a.volume = sfxVolumeNorm();
    a.play().catch(() => {});
  } catch (e) {}
}
function playVictorySound(url) { playOneShot(url); }

function maybePlayVictory() {
  if (!state) { lastResultPlayed = null; return; }
  if (state.result === lastResultPlayed) return;
  lastResultPlayed = state.result;
  if (!state.result || state.result === 'draw') return;
  // Pick whose victory sound to play (the WINNER's). Both sides use the same
  // URL via the shared profile, so the loser hears the winner's sound too.
  let url;
  if (mode === 'single') {
    url = profile.victoryUrl;
  } else if (state.result === myColor) {
    url = profile.victoryUrl;
  } else {
    url = opponentProfile && opponentProfile.victoryUrl;
  }
  playVictorySound(url);
}

/* ── Boot ────────────────────────────────────────────────────── */
captureTop.addEventListener('click', onPocketClick);
captureBottom.addEventListener('click', onPocketClick);
powerupRowTop.addEventListener('click', onPowerUpClick);
powerupRowBot.addEventListener('click', onPowerUpClick);

window.addEventListener('DOMContentLoaded', () => {
  profile = loadProfile();
  applyProfileBackground();
  writeProfileToForm(profile);
  loadYouTubeApi();

  buildPieceEditor();
  refreshPresetSelect();
  refreshCustomPresetSelect();
  try {
    const last = localStorage.getItem(LAST_CONFIG_KEY);
    writeConfigToForm(last ? JSON.parse(last) : DEFAULT_CONFIG);
  } catch (e) {
    writeConfigToForm(DEFAULT_CONFIG);
  }
  setMode('single');
  showScreen('title');
});
