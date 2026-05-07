/* ============================================================
   Chess — Pass-and-Play PWA Prototype  v0.1.0
   ============================================================
   Single-player local game where one human plays both sides,
   alternating turns. Full chess rules: castling, en passant,
   promotion, check/checkmate/stalemate, 50-move rule.
   Board indexing: 0..63, idx 0 = a8 (top-left), idx 63 = h1.
   file = idx % 8 (0..7 = a..h), row = floor(idx/8) (0 = rank 8).
   ============================================================ */

'use strict';

/* ── No service worker (matches the reference pattern) ────────── */
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

const boardEl       = $('board');
const tagTop        = $('tagTop');
const tagBottom     = $('tagBottom');
const captureTop    = $('captureTop');
const captureBottom = $('captureBottom');
const gameStatus    = $('gameStatus');
const btnNew        = $('btnNew');
const btnUndo       = $('btnUndo');
const btnFlip       = $('btnFlip');
const historyList   = $('historyList');
const promoModal    = $('promoModal');

/* ── Constants ───────────────────────────────────────────────── */
const PIECE_CHAR = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };
const COLOR_NAME = { w: 'White', b: 'Black' };
const VALUE      = { p:1, n:3, b:3, r:5, q:9, k:0 };

/* ── State ───────────────────────────────────────────────────── */
let state = freshGame();
let undoStack = [];        // snapshots before each move (for Undo)
let selected = null;       // selected square idx, or null
let legalForSelected = []; // legal moves originating from `selected`
let lastMove = null;       // {from, to} of the most recent move
let flipped = false;       // false = white at bottom, true = black at bottom
let pendingPromo = null;   // array of move candidates while user picks promo piece

/* ── Helpers ─────────────────────────────────────────────────── */
function inBounds(f, r) { return f >= 0 && f < 8 && r >= 0 && r < 8; }
function FR(f, r) { return r * 8 + f; }
function fileOf(i) { return i % 8; }
function rankOf(i) { return Math.floor(i / 8); }
function fileChar(i) { return 'abcdefgh'[fileOf(i)]; }
function rankChar(i) { return '87654321'[rankOf(i)]; }
function squareName(i) { return fileChar(i) + rankChar(i); }

/* ── Initial position ────────────────────────────────────────── */
function freshGame() {
  const board = Array(64).fill(null);
  const back = ['r','n','b','q','k','b','n','r'];
  for (let f = 0; f < 8; f++) {
    board[f]    = { type: back[f], color: 'b' };
    board[8+f]  = { type: 'p',     color: 'b' };
    board[48+f] = { type: 'p',     color: 'w' };
    board[56+f] = { type: back[f], color: 'w' };
  }
  return {
    board,
    turn: 'w',
    castling:  { wk: true, wq: true, bk: true, bq: true },
    enPassant: null,        // idx of square a pawn just skipped, or null
    halfmove:  0,           // half-moves since last pawn move or capture
    fullmove:  1,
    moves:     [],          // SAN strings
    captured:  { w: [], b: [] }, // pieces captured BY each color
    status:    'active',    // 'active' | 'check' | 'checkmate' | 'stalemate' | 'draw'
  };
}

function cloneState(s) {
  return {
    board:     s.board.map(p => p ? { ...p } : null),
    turn:      s.turn,
    castling:  { ...s.castling },
    enPassant: s.enPassant,
    halfmove:  s.halfmove,
    fullmove:  s.fullmove,
    moves:     s.moves.slice(),
    captured:  { w: s.captured.w.slice(), b: s.captured.b.slice() },
    status:    s.status,
  };
}

/* ── Pseudo-legal move generation ────────────────────────────── */
function pseudoMoves(st, idx) {
  const piece = st.board[idx];
  if (!piece) return [];
  const moves = [];
  const f = fileOf(idx), r = rankOf(idx);
  const enemy = piece.color === 'w' ? 'b' : 'w';

  const slide = (df, dr) => {
    let tf = f + df, tr = r + dr;
    while (inBounds(tf, tr)) {
      const t = FR(tf, tr);
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
    if (!inBounds(tf, tr)) return;
    const t = FR(tf, tr);
    const tgt = st.board[t];
    if (!tgt) moves.push({ from: idx, to: t });
    else if (tgt.color === enemy) moves.push({ from: idx, to: t, capture: true });
  };

  switch (piece.type) {
    case 'p': {
      const dir      = piece.color === 'w' ? -1 : 1; // white moves toward rank 8 (row 0)
      const startRow = piece.color === 'w' ? 6 : 1;
      const promoRow = piece.color === 'w' ? 0 : 7;

      // forward 1
      const oneR = r + dir;
      if (inBounds(f, oneR) && !st.board[FR(f, oneR)]) {
        if (oneR === promoRow) {
          for (const promo of ['q','r','b','n']) moves.push({ from: idx, to: FR(f, oneR), promo });
        } else {
          moves.push({ from: idx, to: FR(f, oneR) });
          // forward 2 (only from start)
          if (r === startRow && !st.board[FR(f, r + 2*dir)]) {
            moves.push({ from: idx, to: FR(f, r + 2*dir), double: true });
          }
        }
      }
      // diagonal captures + en passant
      for (const df of [-1, 1]) {
        const tf = f + df, tr = r + dir;
        if (!inBounds(tf, tr)) continue;
        const t = FR(tf, tr);
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
      // castling (path-clear check only — attacked-square check happens in legal filter)
      const homeRow = piece.color === 'w' ? 7 : 0;
      if (r === homeRow && f === 4) {
        const c = st.castling;
        const kSide = piece.color === 'w' ? c.wk : c.bk;
        const qSide = piece.color === 'w' ? c.wq : c.bq;
        const rookK = st.board[FR(7, homeRow)];
        const rookQ = st.board[FR(0, homeRow)];
        if (kSide && rookK && rookK.type === 'r' && rookK.color === piece.color &&
            !st.board[FR(5, homeRow)] && !st.board[FR(6, homeRow)]) {
          moves.push({ from: idx, to: FR(6, homeRow), castle: 'k' });
        }
        if (qSide && rookQ && rookQ.type === 'r' && rookQ.color === piece.color &&
            !st.board[FR(1, homeRow)] && !st.board[FR(2, homeRow)] && !st.board[FR(3, homeRow)]) {
          moves.push({ from: idx, to: FR(2, homeRow), castle: 'q' });
        }
      }
      break;
    }
  }
  return moves;
}

/* ── Square-attack detection ─────────────────────────────────── */
function isAttacked(st, idx, byColor) {
  const f = fileOf(idx), r = rankOf(idx);

  // pawn attacks: a pawn of byColor on (f±1, r + pawnDir) attacks (f, r)
  // pawnDir is the row offset FROM the attacker TO the target.
  // White pawns move r-1 (forward), so they attack from r+1 below.
  const pawnDir = byColor === 'w' ? 1 : -1;
  for (const df of [-1, 1]) {
    const pf = f + df, pr = r + pawnDir;
    if (!inBounds(pf, pr)) continue;
    const p = st.board[FR(pf, pr)];
    if (p && p.color === byColor && p.type === 'p') return true;
  }
  // knight
  for (const [df, dr] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) {
    const nf = f + df, nr = r + dr;
    if (!inBounds(nf, nr)) continue;
    const p = st.board[FR(nf, nr)];
    if (p && p.color === byColor && p.type === 'n') return true;
  }
  // king (adjacent)
  for (const df of [-1,0,1]) for (const dr of [-1,0,1]) {
    if (df === 0 && dr === 0) continue;
    const nf = f + df, nr = r + dr;
    if (!inBounds(nf, nr)) continue;
    const p = st.board[FR(nf, nr)];
    if (p && p.color === byColor && p.type === 'k') return true;
  }
  // sliding (rook/queen orthogonal, bishop/queen diagonal)
  const slideHits = (df, dr, types) => {
    let nf = f + df, nr = r + dr;
    while (inBounds(nf, nr)) {
      const p = st.board[FR(nf, nr)];
      if (p) {
        if (p.color === byColor && types.includes(p.type)) return true;
        return false;
      }
      nf += df; nr += dr;
    }
    return false;
  };
  for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) if (slideHits(df, dr, ['r','q'])) return true;
  for (const [df, dr] of [[1,1],[1,-1],[-1,1],[-1,-1]]) if (slideHits(df, dr, ['b','q'])) return true;
  return false;
}

function findKing(st, color) {
  for (let i = 0; i < 64; i++) {
    const p = st.board[i];
    if (p && p.type === 'k' && p.color === color) return i;
  }
  return -1;
}

/* ── Apply a move (mutates state) ────────────────────────────── */
function applyMoveTo(st, mv) {
  const piece = st.board[mv.from];
  const me = piece.color;

  let captured = st.board[mv.to];
  if (mv.enPassant) {
    const epRow = me === 'w' ? rankOf(mv.to) + 1 : rankOf(mv.to) - 1;
    const epIdx = epRow * 8 + fileOf(mv.to);
    captured = st.board[epIdx];
    st.board[epIdx] = null;
  }

  st.board[mv.to]   = piece;
  st.board[mv.from] = null;

  if (mv.castle) {
    const homeRow = me === 'w' ? 7 : 0;
    if (mv.castle === 'k') {
      st.board[FR(5, homeRow)] = st.board[FR(7, homeRow)];
      st.board[FR(7, homeRow)] = null;
    } else {
      st.board[FR(3, homeRow)] = st.board[FR(0, homeRow)];
      st.board[FR(0, homeRow)] = null;
    }
  }

  if (mv.promo) {
    st.board[mv.to] = { type: mv.promo, color: me };
  }

  if (captured) st.captured[me].push(captured);

  // Castling rights — moving king or rook (or capturing rook on its home square)
  if (piece.type === 'k') {
    if (me === 'w') { st.castling.wk = false; st.castling.wq = false; }
    else            { st.castling.bk = false; st.castling.bq = false; }
  }
  if (piece.type === 'r') {
    if (mv.from === 0)  st.castling.bq = false;
    if (mv.from === 7)  st.castling.bk = false;
    if (mv.from === 56) st.castling.wq = false;
    if (mv.from === 63) st.castling.wk = false;
  }
  if (mv.to === 0)  st.castling.bq = false;
  if (mv.to === 7)  st.castling.bk = false;
  if (mv.to === 56) st.castling.wq = false;
  if (mv.to === 63) st.castling.wk = false;

  // En-passant target — square the pawn skipped over
  st.enPassant = null;
  if (piece.type === 'p' && mv.double) {
    st.enPassant = (mv.from + mv.to) >> 1;
  }

  // Halfmove clock (for 50-move rule)
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
    // Castling: extra check — king must not start in or pass through an attacked square
    if (mv.castle) {
      const homeRow = piece.color === 'w' ? 7 : 0;
      const through = mv.castle === 'k' ? FR(5, homeRow) : FR(3, homeRow);
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
  for (let i = 0; i < 64; i++) {
    const p = st.board[i];
    if (p && p.color === st.turn) out.push(...legalMoves(st, i));
  }
  return out;
}

function refreshStatus(st) {
  const enemy = st.turn === 'w' ? 'b' : 'w';
  const inCheck = isAttacked(st, findKing(st, st.turn), enemy);
  const moves = allLegalMoves(st);
  if (moves.length === 0) st.status = inCheck ? 'checkmate' : 'stalemate';
  else if (st.halfmove >= 100) st.status = 'draw';
  else if (inCheck) st.status = 'check';
  else st.status = 'active';
}

/* ── Standard Algebraic Notation ─────────────────────────────── */
function moveToSAN(stBefore, mv) {
  if (mv.castle) return appendCheckSuffix(stBefore, mv, mv.castle === 'k' ? 'O-O' : 'O-O-O');

  const piece = stBefore.board[mv.from];
  let str = piece.type === 'p' ? '' : piece.type.toUpperCase();

  if (piece.type !== 'p') {
    const ambiguous = [];
    for (let i = 0; i < 64; i++) {
      if (i === mv.from) continue;
      const p = stBefore.board[i];
      if (!p || p.type !== piece.type || p.color !== piece.color) continue;
      if (legalMoves(stBefore, i).some(m => m.to === mv.to)) ambiguous.push(i);
    }
    if (ambiguous.length) {
      const sameFile = ambiguous.some(i => fileOf(i) === fileOf(mv.from));
      const sameRank = ambiguous.some(i => rankOf(i) === rankOf(mv.from));
      if (!sameFile)      str += fileChar(mv.from);
      else if (!sameRank) str += rankChar(mv.from);
      else                str += fileChar(mv.from) + rankChar(mv.from);
    }
  }
  if (mv.capture) {
    if (piece.type === 'p') str += fileChar(mv.from);
    str += 'x';
  }
  str += squareName(mv.to);
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

/* ── UI rendering ────────────────────────────────────────────── */
function isGameOver() {
  return state.status === 'checkmate' || state.status === 'stalemate' || state.status === 'draw';
}

function renderBoard() {
  boardEl.innerHTML = '';

  const order = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) order.push(FR(f, r));
  if (flipped) order.reverse();

  const inCheckIdx = (state.status === 'check' || state.status === 'checkmate')
    ? findKing(state, state.turn) : -1;

  for (const idx of order) {
    const f = fileOf(idx), r = rankOf(idx);
    const isLight = (f + r) % 2 === 0;
    const sq = document.createElement('button');
    sq.type = 'button';
    sq.className = 'sq ' + (isLight ? 'sq--light' : 'sq--dark');
    sq.dataset.i = idx;
    sq.setAttribute('aria-label', squareName(idx));

    if (lastMove && (lastMove.from === idx || lastMove.to === idx)) sq.classList.add('sq--last');
    if (selected === idx) sq.classList.add('sq--sel');
    if (idx === inCheckIdx) sq.classList.add('sq--check');

    const target = legalForSelected.find(m => m.to === idx);
    if (target) sq.classList.add(target.capture || target.enPassant ? 'sq--legal-cap' : 'sq--legal');

    const piece = state.board[idx];
    if (piece) {
      const span = document.createElement('span');
      span.className = 'sq__piece sq__piece--' + piece.color;
      span.textContent = PIECE_CHAR[piece.type];
      sq.appendChild(span);
    }

    // edge coordinates (rank on left edge, file on bottom edge — relative to current orientation)
    const isLeftCol   = flipped ? (f === 7) : (f === 0);
    const isBottomRow = flipped ? (r === 0) : (r === 7);
    if (isLeftCol) {
      const c = document.createElement('span');
      c.className = 'sq__coord sq__coord--rank';
      c.textContent = rankChar(idx);
      sq.appendChild(c);
    }
    if (isBottomRow) {
      const c = document.createElement('span');
      c.className = 'sq__coord sq__coord--file';
      c.textContent = fileChar(idx);
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

function renderStatus() {
  let text = '', kind = 'neutral';
  if (state.status === 'checkmate') {
    text = `Checkmate — ${state.turn === 'w' ? 'Black' : 'White'} wins.`;
    kind = 'good';
  } else if (state.status === 'stalemate') {
    text = 'Stalemate — draw.';
    kind = 'warn';
  } else if (state.status === 'draw') {
    text = 'Draw (50-move rule).';
    kind = 'warn';
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
  renderBoard();
  renderTags();
  renderCaptures();
  renderStatus();
  renderHistory();
  btnUndo.disabled = undoStack.length === 0;
}

/* ── Interaction ─────────────────────────────────────────────── */
function onSquareClick(idx) {
  if (isGameOver() || pendingPromo) return;

  const piece = state.board[idx];

  // Already have a piece selected — try to move or reselect
  if (selected !== null) {
    const matches = legalForSelected.filter(m => m.to === idx);
    if (matches.length === 1) {
      finalizeMove(matches[0]);
      return;
    }
    if (matches.length > 1) {
      // Multiple candidates with same source/target = pawn promotion
      showPromotion(matches);
      return;
    }
    // Reselect another own piece
    if (piece && piece.color === state.turn) {
      selected = idx;
      legalForSelected = legalMoves(state, idx);
      render();
      return;
    }
    // Otherwise clear selection
    selected = null;
    legalForSelected = [];
    render();
    return;
  }

  // No selection yet — pick up own piece
  if (piece && piece.color === state.turn) {
    selected = idx;
    legalForSelected = legalMoves(state, idx);
    render();
  }
}

function showPromotion(candidates) {
  pendingPromo = candidates;
  promoModal.hidden = false;
}

function finalizeMove(mv) {
  const before = cloneState(state);
  undoStack.push(before);
  applyMoveTo(state, mv);
  refreshStatus(state);
  state.moves.push(moveToSAN(before, mv));
  lastMove = { from: mv.from, to: mv.to };
  selected = null;
  legalForSelected = [];
  render();
}

document.querySelectorAll('.promo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!pendingPromo) return;
    const mv = pendingPromo.find(m => m.promo === btn.dataset.promo);
    pendingPromo = null;
    promoModal.hidden = true;
    if (mv) finalizeMove(mv);
  });
});

btnNew.addEventListener('click', () => {
  state = freshGame();
  undoStack = [];
  selected = null;
  legalForSelected = [];
  lastMove = null;
  pendingPromo = null;
  promoModal.hidden = true;
  render();
});

btnUndo.addEventListener('click', () => {
  if (!undoStack.length) return;
  state = undoStack.pop();
  selected = null;
  legalForSelected = [];
  lastMove = null;
  render();
});

btnFlip.addEventListener('click', () => {
  flipped = !flipped;
  render();
});

/* ── Boot ────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', render);
