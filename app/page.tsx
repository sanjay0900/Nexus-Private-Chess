'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Chess, Square } from 'chess.js';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Color = 'white' | 'black';

type GameRow = {

room_code: string;

fen: string;

turn: Color;

status: string;

white_id: string | null;

black_id: string | null;

  white_name: string | null;

  black_name: string | null;

updated_at: string;

started_at: string | null;

};

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const pieceMap: Record<string, string> = {

wK: '♔',

wQ: '♕',

wR: '♖',

wB: '♗',

wN: '♘',

wP: '♙',

bK: '♚',

bQ: '♛',

bR: '♜',

bB: '♝',

bN: '♞',

bP: '♟',

};

const initialPieceCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

function getCapturedPieces(board: ReturnType<Chess['board']>, color: 'w' | 'b') {
  const counts: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  for (const rank of board) for (const piece of rank) if (piece?.color === color) counts[piece.type] += 1;
  const missing: string[] = [];
  (['q', 'r', 'b', 'n', 'p'] as const).forEach((type) => {
    const lost = initialPieceCounts[type] - counts[type];
    for (let i = 0; i < lost; i += 1) missing.push(type);
  });
  return missing;
}

function uid() {

return Math.random().toString(36).slice(2) + Date.now().toString(36);

}

function formatGameTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function supabase() {

const u = process.env.NEXT_PUBLIC_SUPABASE_URL;

const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

return u && k ? createClient(u, k) : null;

}

const pieceInfo = [

{

name: 'King',

symbol: '♔',

movement: 'One square in any direction.',

note: 'The king is the most important piece. If the king is checkmated, the game ends.',

},

{

name: 'Queen',

symbol: '♕',

movement: 'Any number of squares horizontally, vertically, or diagonally.',

note: 'The most powerful piece on the board.',

},

{

name: 'Rook',

symbol: '♖',

movement: 'Any number of squares horizontally or vertically.',

note: 'Rooks become especially powerful on open files and ranks.',

},

{

name: 'Bishop',

symbol: '♗',

movement: 'Any number of squares diagonally.',

note: 'A bishop always stays on the same color square.',

},

{

name: 'Knight',

symbol: '♘',

movement: 'Moves in an L-shape: two squares one way and one square perpendicular.',

note: 'The knight can jump over other pieces.',

},

{

name: 'Pawn',

symbol: '♙',

movement:

'Moves forward one square. From its starting position it can move two squares. Captures diagonally.',

note: 'Pawns move differently depending on whether they are moving or capturing.',

},

];

export default function Home() {

const [game, setGame] = useState<GameRow | null>(null);

const [selected, setSelected] = useState<string | null>(null);

const [code, setCode] = useState('');

const [player, setPlayer] = useState<Color | null>(null);

const [name, setName] = useState('Player');

const [msg, setMsg] = useState('Create a private room or join one.');

const [mounted, setMounted] = useState(false);

const [busy, setBusy] = useState(false);

const [copied, setCopied] = useState(false);

const [moveList, setMoveList] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [turnPulse, setTurnPulse] = useState(false);
  const previousTurnRef = useRef<Color | null>(null);

const [activeTab, setActiveTab] = useState<'play' | 'learn'>('play');

const chessQuotes = [
  {
    quote: 'You may learn much more from a game you lose than from a game you win.',
    author: 'José Raúl Capablanca',
  },
  {
    quote: 'When you see a good move, look for a better one.',
    author: 'Emanuel Lasker',
  },
  {
    quote: 'There are two types of sacrifices: correct ones, and mine.',
    author: 'Mikhail Tal',
  },
  {
    quote: 'I don’t believe in psychology. I believe in good moves.',
    author: 'Bobby Fischer',
  },
  {
    quote: 'Chess is life in miniature.',
    author: 'Garry Kasparov',
  },
];

const [quoteIndex, setQuoteIndex] = useState(0);

useEffect(() => {
  const interval = window.setInterval(() => {
    setQuoteIndex((index) => (index + 1) % chessQuotes.length);
  }, 12000);

  return () => window.clearInterval(interval);
}, []);

const idRef = useRef('');

const sbRef = useRef<SupabaseClient | null>(null);

const gameRef = useRef<GameRow | null>(null);

gameRef.current = game;

const previousFenRef = useRef<string | null>(null);

useEffect(() => {
  const nextFen = game?.fen;
  const previousFen = previousFenRef.current;
  if (nextFen && previousFen && previousFen !== nextFen) {
    try {
      const previous = new Chess(previousFen);
      for (const candidate of previous.moves({ verbose: true }) as any[]) {
        const test = new Chess(previousFen);
        test.move({ from: candidate.from, to: candidate.to, promotion: candidate.promotion || 'q' });
        if (test.fen() === nextFen) {
          setLastMove({ from: candidate.from, to: candidate.to });
          break;
        }
      }
    } catch {}
  }
  previousFenRef.current = nextFen || null;
}, [game?.fen]);

useEffect(() => {
  const currentTurn = game?.turn || null;
  const previousTurn = previousTurnRef.current;

  if (currentTurn && previousTurn && currentTurn !== previousTurn && game?.status === 'playing') {
    setTurnPulse(true);
    const timeout = window.setTimeout(() => setTurnPulse(false), 900);
    previousTurnRef.current = currentTurn;
    return () => window.clearTimeout(timeout);
  }

  previousTurnRef.current = currentTurn;
}, [game?.turn, game?.status]);

useEffect(() => {
  if (!game?.started_at) {
    setElapsedSeconds(0);
    return;
  }

  const start = new Date(game.started_at).getTime();

  const updateElapsed = () => {
    const end = game.status === 'finished'
      ? new Date(game.updated_at).getTime()
      : Date.now();

    if (game.status === 'playing' || game.status === 'finished') {
      setElapsedSeconds(Math.max(0, Math.floor((end - start) / 1000)));
    } else {
      setElapsedSeconds(0);
    }
  };

  updateElapsed();

  if (game.status !== 'playing') return;

  const interval = window.setInterval(updateElapsed, 1000);
  return () => window.clearInterval(interval);
}, [game?.started_at, game?.status, game?.updated_at]);

const useCloud =

!!process.env.NEXT_PUBLIC_SUPABASE_URL &&

!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

useEffect(() => {

idRef.current =

localStorage.getItem('nexus-player-id') || uid();

localStorage.setItem('nexus-player-id', idRef.current);

sbRef.current = supabase();

setMounted(true);

}, []);

const chess = useMemo(() => {

const c = new Chess();

if (game?.fen) {

try {

c.load(game.fen);

} catch {}

}

return c;

}, [game?.fen]);

const board = chess.board();

const turn = game?.turn || 'white';

const legalMoves = useMemo(() => {
  if (!selected || !player || turn !== player) return [];
  try { return chess.moves({ square: selected as Square, verbose: true }) as any[]; } catch { return []; }
}, [chess, selected, player, turn]);

const legalTargets = useMemo(() => new Set(legalMoves.map((move) => move.to)), [legalMoves]);
const captureTargets = useMemo(() => new Set(legalMoves.filter((move) => move.captured).map((move) => move.to)), [legalMoves]);

const checkSquare = useMemo(() => {
  if (!chess.isCheck()) return null;
  const targetColor = chess.turn();
  for (let r = 0; r < board.length; r += 1) for (let f = 0; f < board[r].length; f += 1) {
    const piece = board[r][f];
    if (piece?.type === 'k' && piece.color === targetColor) return files[f] + (8 - r);
  }
  return null;
}, [chess, board]);

const capturedByWhite = useMemo(() => getCapturedPieces(board, 'b'), [board]);
const capturedByBlack = useMemo(() => getCapturedPieces(board, 'w'), [board]);

const gameResult = useMemo(() => {
  if (!game || game.status !== 'finished') return null;

  if (chess.isCheckmate()) {
    const loser = chess.turn() === 'w' ? 'white' : 'black';
    const winner = loser === 'white' ? 'black' : 'white';
    const winnerName = winner === 'white'
      ? (game.white_name || 'White')
      : (game.black_name || 'Black');

    return {
      type: 'CHECKMATE',
      title: winner === player ? 'YOU WIN' : 'YOU LOSE',
      detail: `${winnerName} wins by checkmate.`,
    };
  }

  if (chess.isStalemate()) {
    return {
      type: 'STALEMATE',
      title: 'STALEMATE',
      detail: 'No legal moves remain. The game is a draw.',
    };
  }

  return {
    type: 'DRAW',
    title: 'DRAW',
    detail: 'The game ended in a draw.',
  };
}, [game, chess, player]);

async function getLocal(r: string) {

const res = await fetch(

'/api/games?room=' + encodeURIComponent(r),

{ cache: 'no-store' }

);

if (!res.ok) return null;

return (await res.json()) as GameRow;

}

async function createRoom() {

setBusy(true);

try {

if (useCloud) {

const r = Math.random()

.toString(36)

.slice(2, 8)

.toUpperCase();

const row: GameRow = {

room_code: r,

fen: new Chess().fen(),

turn: 'white',

status: 'waiting',

white_id: idRef.current,

black_id: null,

          white_name: name.trim() || 'White',

          black_name: null,

updated_at: new Date().toISOString(),

started_at: null,

};

const { error } =

await sbRef.current!.from('games').insert(row);

if (error) throw new Error(error.message);

setGame(row);

setPlayer('white');

setCode(r);

setMsg('Room created. Share the code with your opponent.');

} else {

const res = await fetch('/api/games', {

method: 'POST',

headers: {

'Content-Type': 'application/json',

},

body: JSON.stringify({

action: 'create',

playerId: idRef.current,

}),

});

const row = (await res.json()) as GameRow;

setGame(row);

setPlayer('white');

setCode(row.room_code);

setMsg('Local room created.');

}

} catch (e: any) {

setMsg(e.message || 'Could not create room.');

} finally {

setBusy(false);

}

}

async function joinRoom() {

const r = code.trim().toUpperCase();

if (r.length !== 6) return;

setBusy(true);

try {

if (useCloud) {

const { data, error } =

await sbRef.current!

.from('games')

.select('\*')

.eq('room_code', r)

.single();

if (error || !data) {

throw new Error('Room not found. Check the code.');

}

if (

data.black_id &&

data.black_id !== idRef.current

) {

throw new Error('Room is full.');

}

let row = data as GameRow;

if (!row.black_id) {

const upd = {

black_id: idRef.current,

            black_name: name.trim() || 'Black',

status: 'playing',

started_at: new Date().toISOString(),

updated_at: new Date().toISOString(),

};

const q =

await sbRef.current!

.from('games')

.update(upd)

.eq('room_code', r)

.is('black_id', null);

if (q.error) throw new Error(q.error.message);

row = {

...row,

...upd,

};

}

setGame(row);

setPlayer(

row.white_id === idRef.current

? 'white'

: 'black'

);

setMsg(`Joined room ${r}.`);

} else {

const res = await fetch('/api/games', {

method: 'POST',

headers: {

'Content-Type': 'application/json',

},

body: JSON.stringify({

action: 'join',

room: r,

playerId: idRef.current,

}),

});

if (!res.ok) {

const e = await res.json();

throw new Error(

e.error || 'Room not found.'

);

}

const row = (await res.json()) as GameRow;

setGame(row);

setPlayer(

row.white_id === idRef.current

? 'white'

: 'black'

);

setMsg(`Joined room ${r}.`);

}

} catch (e: any) {

setMsg(e.message || 'Could not join room.');

} finally {

setBusy(false);

}

}

useEffect(() => {

if (!game || !player) return;

if (useCloud) {

const sb = sbRef.current!;

const ch = sb

.channel(`game-${game.room_code}`)

.on(

'postgres_changes',

{

event: '\*',

schema: 'public',

table: 'games',

filter: `room_code=eq.${game.room_code}`,

},

(p) => {

const payload = p.new as Partial<GameRow> | null;

if (payload?.room_code) {

setGame(payload as GameRow);

setSelected(null);

}

}

)

.subscribe();

return () => {

sb.removeChannel(ch);

};

}

const timer = setInterval(async () => {

const latest = await getLocal(

game.room_code

);

if (

latest &&

latest.updated_at !==

gameRef.current?.updated_at

) {

setGame(latest);

setSelected(null);

}

}, 500);

return () => clearInterval(timer);

}, [

game?.room_code,

player,

useCloud,

]);

async function makeMove(from: string, to: string) {
  if (!game) return;

  let notation = to;
  try {
    const preview = new Chess(game.fen);
    notation = preview.move({ from, to, promotion: 'q' }).san;
  } catch {}


if (

!game ||

!player ||

game.turn !== player ||

game.status === 'finished'

) {

return;

}

setBusy(true);

try {

if (useCloud) {

const g = new Chess(game.fen);

const m = g.move({

from,

to,

promotion: 'q',

});

const next: GameRow = {

...game,

fen: g.fen(),

turn:

g.turn() === 'w'

? 'white'

: 'black',

status:

g.isGameOver()

? 'finished'

: 'playing',

updated_at:

new Date().toISOString(),

};

const { error } =

await sbRef.current!

.from('games')

.update(next)

.eq('room_code', game.room_code)

.eq('fen', game.fen);

if (error) {

throw new Error(error.message);

}

setMoveList((v) => [...v, notation]);
setLastMove({ from, to });

setGame(next);

} else {

const res = await fetch(

'/api/games',

{

method: 'PATCH',

headers: {

'Content-Type':

'application/json',

},

body: JSON.stringify({

action: 'move',

room: game.room_code,

playerId: idRef.current,

from,

to,

promotion: 'q',

}),

}

);

const row =

await res.json();

if (!res.ok) {

throw new Error(

row.error ||

'Move failed'

);

}

setGame(row);

setMoveList((v) => [...v, notation]);
setLastMove({ from, to });

}

setSelected(null);

} catch (e: any) {

setMsg(

e.message ||

'Illegal move.'

);

} finally {

setBusy(false);

}

}

function squareClick(

sq: string,

p: any

) {

if (

busy ||

game?.turn !== player

) {

return;

}

if (selected) {

if (selected === sq) {

setSelected(null);

return;

}

if (legalTargets.has(sq)) makeMove(selected, sq);
else if (p && ((p.color === 'w' && player === 'white') || (p.color === 'b' && player === 'black'))) setSelected(sq);
else setSelected(null);

return;

}

if (

p &&

(

(p.color === 'w' &&

player === 'white') ||

(p.color === 'b' &&

player === 'black')

)

) {

setSelected(sq);

}

}

async function playAgain() {
  setGame(null);
  setPlayer(null);
  setCode('');
  setSelected(null);
  setMoveList([]);
  setLastMove(null);
  setElapsedSeconds(0);
  setMsg('Starting a new game...');
  await createRoom();
}

function leaveGame() {
  setGame(null);
  setPlayer(null);
  setCode('');
  setSelected(null);
  setMoveList([]);
  setLastMove(null);
  setElapsedSeconds(0);
  setMsg('Create a private room or join one.');
}

function copy() {

navigator.clipboard?.writeText(

game?.room_code || code

);

setCopied(true);

setTimeout(

() => setCopied(false),

1200

);

}

if (!mounted) {

return (

<main className="chess-app">

<div className="loading">

Loading Chess…

</div>

</main>

);

}

return (

<main className="chess-app">

<style>{`
  .chess-app {
    position: relative;
    isolation: isolate;
    background:
      radial-gradient(circle at 50% 18%, rgba(255, 248, 232, 0.96) 0%, rgba(246, 238, 220, 0.88) 34%, rgba(225, 209, 184, 0.72) 100%),
      #e8dcc8;
  }

  .chess-app::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    opacity: 0.32;
    background:
      radial-gradient(circle at 18% 24%, rgba(91, 60, 34, 0.09) 0 1px, transparent 1.5px),
      radial-gradient(circle at 74% 68%, rgba(91, 60, 34, 0.07) 0 1px, transparent 1.5px),
      repeating-linear-gradient(0deg, rgba(83, 57, 35, 0.018) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(90deg, rgba(83, 57, 35, 0.014) 0 1px, transparent 1px 5px);
    background-size: 9px 9px, 13px 13px, auto, auto;
    mix-blend-mode: multiply;
  }

  .chess-app::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(circle at center, transparent 35%, rgba(48, 32, 20, 0.075) 100%),
      linear-gradient(115deg, transparent 0 48%, rgba(126, 93, 58, 0.035) 50%, transparent 52%);
  }

  .chess-app > * {
    position: relative;
    z-index: 1;
  }

  .player-bar {
    transition: box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease;
  }

  .player-bar.turn-pulse {
    animation: nexusTurnGlow 900ms ease-out;
  }

  .board-frame {
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  .board-frame.turn-pulse {
    animation: nexusBoardPulse 900ms ease-out;
  }

  .turn-status {
    transition: color 180ms ease, font-weight 180ms ease;
  }

  .turn-status.your-turn {
    font-weight: 800;
  }

  @keyframes nexusTurnGlow {
    0% {
      transform: translateY(0);
      box-shadow: 0 0 0 rgba(177, 137, 91, 0);
    }
    35% {
      transform: translateY(-1px);
      box-shadow: 0 0 28px rgba(177, 137, 91, 0.42), 0 0 0 1px rgba(177, 137, 91, 0.28);
    }
    100% {
      transform: translateY(0);
      box-shadow: 0 0 0 rgba(177, 137, 91, 0);
    }
  }

  .chess-quote-card {
    margin-top: 16px;
    padding: 22px 22px 18px;
    border: 1px solid rgba(126, 98, 67, 0.28);
    border-radius: 16px;
    background: rgba(255, 252, 245, 0.72);
    box-shadow: 0 10px 30px rgba(72, 49, 29, 0.07);
  }

  .quote-label {
    font-size: 10px;
    letter-spacing: 0.22em;
    font-weight: 800;
    color: #8d765c;
  }

  .quote-mark {
    height: 18px;
    margin-top: 10px;
    font-family: Georgia, serif;
    font-size: 36px;
    line-height: 1;
    color: #b08a5e;
  }

  .quote-text {
    margin: 2px 0 12px;
    color: #30251b;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 17px;
    line-height: 1.45;
  }

  .quote-author {
    color: #75614c;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .quote-dots {
    display: flex;
    gap: 5px;
    margin-top: 14px;
  }

  .quote-dots span {
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: rgba(117, 97, 76, 0.3);
    transition: width 180ms ease, background 180ms ease;
  }

  .quote-dots span.active {
    width: 14px;
    background: #8d765c;
  }

  @media (max-width: 900px) {
    .chess-quote-card {
      margin-top: 14px;
    }
  }

  @keyframes nexusBoardPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 rgba(177, 137, 91, 0);
    }
    35% {
      transform: scale(1.006);
      box-shadow: 0 0 34px rgba(177, 137, 91, 0.24);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 rgba(177, 137, 91, 0);
    }
  }
`}</style>

{/* HEADER */}

<header className="site-header">

<div className="brand">

<div className="brand-mark">

♞

</div>

<div>

<div className="brand-name">

NEXUS CHESS

</div>

<div className="brand-sub">

PRIVATE ONLINE CHESS

</div>

</div>

</div>

<nav className="nav">

<button

className={

activeTab === 'play'

? 'nav-active'

: ''

}

onClick={() =>

setActiveTab('play')

}

>

Play

</button>

<button

className={

activeTab === 'learn'

? 'nav-active'

: ''

}

onClick={() =>

setActiveTab('learn')

}

>

Learn Chess

</button>

</nav>

<div className="connection">

<span className="connection-dot" />

{useCloud

? 'ONLINE'

: 'LOCAL'}

</div>

</header>

{/* LEARN */}

{activeTab === 'learn' ? (

<section className="learn-page">

<div className="learn-hero">

<div>

<div className="eyebrow">

CHESS BASICS

</div>

<h1>

Learn the game

<span> from the board up.</span>

</h1>

<p>

New to chess? Start here.

Learn how every piece moves,

how captures work, and how

a game is won.

</p>

</div>

</div>

<div className="rules-grid">

{pieceInfo.map(

(piece) => (

<article

className="piece-card"

key={piece.name}

>

<div className="piece-icon">

{piece.symbol}

</div>

<div>

<span className="piece-name">

{piece.name}

</span>

<h3>

{piece.movement}

</h3>

<p>

{piece.note}

</p>

</div>

</article>

)

)}

</div>

<div className="rules-section">

<div className="section-label">

THE BASICS

</div>

<div className="basics-grid">

<div>

<h3>

Check

</h3>

<p>

Your king is under

immediate attack.

You must respond by

moving the king,

blocking the attack,

or capturing the

attacking piece.

</p>

</div>

<div>

<h3>

Checkmate

</h3>

<p>

The king is in check

and there is no legal

move to escape.

Checkmate ends the game.

</p>

</div>

<div>

<h3>

Stalemate

</h3>

<p>

A player has no legal

move, but their king

is not in check.

The game is a draw.

</p>

</div>

<div>

<h3>

Castling

</h3>

<p>

A special move involving

the king and rook.

It helps move the king

to safety and activate

the rook.

</p>

</div>

</div>

</div>

<button

className="learn-play"

onClick={() =>

setActiveTab('play')

}

>

PLAY A GAME →

</button>

</section>

) : (

<>

{/* LOBBY */}

{!game ? (

<section className="lobby-page">

<div className="lobby-hero">

<div>

<div className="eyebrow">

PRIVATE · 2 PLAYER · REALTIME

</div>

<h1>

Play chess.

<br />

<span>Play someone you know.</span>

</h1>

<p>

Create a private room,

share the six-character code,

and play together from

different devices.

</p>

</div>

<div className="chess-emblem">

<span>♔</span>

<span>♕</span>

<span>♜</span>

<span>♞</span>

</div>

</div>

<div className="lobby-grid">

<div className="lobby-card">

<div className="card-number">

01

</div>

<div className="card-label">

CREATE

</div>

<h2>

Start a private game

</h2>

<p>

Create a room and invite

your opponent.

</p>

<input

value={name}

onChange={(e) =>

setName(

e.target.value

)

}

placeholder="Your name"

/>

<button

className="primary-button"

onClick={createRoom}

disabled={busy}

>

{busy

? 'CREATING…'

: 'CREATE ROOM'}

<span>→</span>

</button>

</div>

<div className="or-divider">

OR

</div>

<div className="lobby-card">

<div className="card-number">

02

</div>

<div className="card-label">

JOIN

</div>

<h2>

Join a private game

</h2>

<p>

Enter the room code

your opponent shared.

</p>

<input

value={code}

onChange={(e) =>

setCode(

e.target.value

.replace(

/[^a-z0-9]/gi,

''

)

.slice(

0,

6

)

.toUpperCase()

)

}

maxLength={6}

placeholder="ABC123"

/>

<button

className="secondary-button"

onClick={joinRoom}

disabled={

busy ||

code.length !== 6

}

>

{busy

? 'JOINING…'

: 'JOIN ROOM'}

<span>→</span>

</button>

</div>

</div>

<div className="learn-callout">

<div>

<strong>

New to chess?

</strong>

<span>

Learn how every piece moves

before you start.

</span>

</div>

<button

onClick={() =>

setActiveTab(

'learn'

)

}

>

CHESS GUIDE →

</button>

</div>

</section>

) : (

<section className="game-page">

<div className="game-top">

<div>

<div className="eyebrow">

PRIVATE MATCH

</div>

<h1>

Room {game.room_code}

</h1>

</div>

<button

className="room-code"

onClick={copy}

>

<span>

ROOM CODE

</span>

<strong>

{copied

? 'COPIED'

: game.room_code}

</strong>

</button>

</div>

<div className="game-layout">

<div className="board-column">

<div className={`player-bar ${turnPulse && turn === player ? 'turn-pulse' : ''}`}>

<div className="player-info">

<div className="player-piece">

{player ===

'white'

? '♔'

: '♚'}

</div>

<div>

<strong>

{player === 'white' ? game.white_name || 'White' : game.black_name || 'Black'}

</strong>

<span>

{player ===

'white'

? 'WHITE'

: 'BLACK'}

</span>

                          <div className="captured-row">
                            {(player === 'white' ? capturedByWhite : capturedByBlack).map((type, index) => (
                              <span key={`${type}-${index}`}>{pieceMap[`${player === 'white' ? 'b' : 'w'}${type.toUpperCase()}`]}</span>
                            ))}
                          </div>
                        </div>

</div>

<div

className={

turn === player

? 'turn-badge active'

: 'turn-badge'

}

>

{turn === player

? 'YOUR TURN'

: 'WAITING'}

</div>

</div>

<div className={`board-frame ${turnPulse && turn === player ? 'turn-pulse' : ''}`}>

<div className="board">

{board.map(

(rank, r) =>

rank.map(

(p, f) => {

const sq =

files[f] +

(8 - r);

return (

<button

type="button"

disabled={game?.status === 'finished'}

key={sq}

aria-label={

sq

}

className={`

square

${

(r +

f) %

2

? 'dark'

: 'light'

}

${

selected ===

sq

? 'selected'

: ''

}

${

p

? 'occupied'

: ''

}

${legalTargets.has(sq) ? (captureTargets.has(sq) ? 'legal-capture' : 'legal-move') : ''}

${lastMove?.from === sq || lastMove?.to === sq ? 'last-move' : ''}

${checkSquare === sq ? 'in-check' : ''}

`}

onClick={() =>

squareClick(

sq,

p

)

}

>

{legalTargets.has(sq) && <span className="legal-indicator" aria-hidden="true" />}

<span

className={`

piece

${

p?.color ===

'w'

? 'white-piece'

: 'black-piece'

}

`}

>

{p

? pieceMap[

p.color +

p.type.toUpperCase()

]

: ''}

</span>

{f ===

0 && (

<small className="rank">

{8 -

r}

</small>

)}

{r ===

7 && (

<small className="file">

{

files[

f

]

}

</small>

)}

</button>

);

}

)

)}

</div>

</div>

<div className="board-footer">

<span>

{turn ===

player

? 'Your turn'

: 'Opponent’s turn'}

</span>

<span className="game-timer">
GAME TIME&nbsp;&nbsp;
<strong>{formatGameTime(elapsedSeconds)}</strong>
</span>

<span>

{useCloud

? 'Live · Supabase'

: 'Local realtime'}

</span>

</div>

</div>

<aside className="game-sidebar">

<div className="match-card">

<div className="match-player">

<div className="mini-piece white">

♔

</div>

<div>

<span>

WHITE

</span>

<strong>

                          {game.white_name || 'White'}

</strong>

</div>

</div>

<div className="vs">

VS

</div>

<div className="match-player">

<div className="mini-piece black">

♚

</div>

<div>

<span>

BLACK

</span>

<strong>

                          {game.black_name || 'Black'}

</strong>

</div>

</div>

</div>

<div className="status-card">

<span className="live-dot" />

{game.status ===

'waiting'

? 'WAITING FOR OPPONENT'

: 'GAME IN PROGRESS'}

<strong>
                      {game.status === 'waiting'
                        ? 'SHARE THE CODE TO START'
                        : game.turn === 'white'
                          ? 'WHITE TO MOVE'
                          : 'BLACK TO MOVE'}
                    </strong>

</div>

<div className="moves-card">

<div className="moves-header">

<span>

MOVE HISTORY

</span>

<span>

{moveList.length}

</span>

</div>

<div className="move-list">

{moveList.length ? (
Array.from({ length: Math.ceil(moveList.length / 2) }).map((_, row) => (
<div key={row} className="move-row">
<span>{row + 1}.</span>
<strong>{moveList[row * 2]}</strong>
<strong className="black-move">{moveList[row * 2 + 1] || '—'}</strong>
</div>
))
) : (

<div className="empty-moves">

No moves yet

</div>

)}

</div>

</div>

<div className="chess-quote-card">
  <div className="quote-label">FROM THE CHESSBOARD</div>
  <div className="quote-mark">“</div>
  <p className="quote-text">{chessQuotes[quoteIndex].quote}</p>
  <div className="quote-author">— {chessQuotes[quoteIndex].author}</div>
  <div className="quote-dots">
    {chessQuotes.map((_, index) => (
      <span key={index} className={index === quoteIndex ? 'active' : ''} />
    ))}
  </div>
</div>

<div className="side-actions">

<button

onClick={copy}

>

{copied

? 'COPIED'

: 'COPY ROOM CODE'}

</button>

<button

onClick={leaveGame}

>

LEAVE GAME

</button>

</div>

</aside>

</div>

<div className="message-bar">

{msg}

</div>

</section>

)}

{gameResult && (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="game-result-title"
    style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'rgba(24, 17, 11, 0.68)', backdropFilter: 'blur(8px)',
    }}
  >
    <div
      style={{
        width: 'min(460px, 100%)', border: '1px solid rgba(177, 137, 91, 0.55)', borderRadius: '18px',
        padding: '34px 30px 30px', background: 'linear-gradient(145deg, rgba(249, 241, 224, 0.98), rgba(232, 214, 184, 0.98))',
        boxShadow: '0 30px 90px rgba(0,0,0,0.38)', textAlign: 'center', color: '#2d2117',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.24em', color: '#9b7045', marginBottom: '12px' }}>GAME OVER</div>
      <div style={{ fontSize: '42px', lineHeight: 1, marginBottom: '12px' }}>
        {gameResult.type === 'CHECKMATE' ? '♛' : '½'}
      </div>
      <h2 id="game-result-title" style={{ margin: 0, fontSize: '28px', letterSpacing: '0.08em', fontWeight: 900 }}>{gameResult.title}</h2>
      <p style={{ margin: '12px 0 24px', fontSize: '15px', lineHeight: 1.6, color: '#665242' }}>{gameResult.detail}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '14px 16px', marginBottom: '24px', borderRadius: '12px', background: 'rgba(255,255,255,0.42)', border: '1px solid rgba(126, 93, 58, 0.18)' }}>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '0.18em', fontWeight: 800, color: '#9b7045' }}>RESULT</div>
          <div style={{ marginTop: '5px', fontSize: '14px', fontWeight: 800 }}>{gameResult.type}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '0.18em', fontWeight: 800, color: '#9b7045' }}>GAME TIME</div>
          <div style={{ marginTop: '5px', fontSize: '14px', fontWeight: 800 }}>{formatGameTime(elapsedSeconds)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button type="button" onClick={playAgain} disabled={busy} style={{ flex: 1, minHeight: '46px', border: '1px solid #8f643c', borderRadius: '10px', background: '#2d2117', color: '#f8edda', fontSize: '12px', fontWeight: 900, letterSpacing: '0.12em', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.65 : 1 }}>PLAY AGAIN</button>
        <button type="button" onClick={leaveGame} style={{ flex: 1, minHeight: '46px', border: '1px solid rgba(126, 93, 58, 0.35)', borderRadius: '10px', background: 'rgba(255,255,255,0.38)', color: '#2d2117', fontSize: '12px', fontWeight: 900, letterSpacing: '0.12em', cursor: 'pointer' }}>LEAVE GAME</button>
      </div>
    </div>
  </div>
)}

</>

)}

<footer className="site-footer">

<span>

NEXUS CHESS

</span>

<span>

PRIVATE · REALTIME · MOBILE READY

</span>

<span>

BUILT FOR TWO

</span>

<div className="site-credit">

<span>Built by</span> <strong>Sanjay Das</strong> <span>·</span> <span>@S4Sanjay_das</span>

</div>

</footer>

</main>

);

}