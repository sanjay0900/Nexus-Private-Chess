import { NextResponse } from 'next/server';
import { Chess } from 'chess.js';

type Game = {
  room_code: string;
  fen: string;
  turn: 'white' | 'black';
  status: 'waiting' | 'playing' | 'finished';
  white_id: string | null;
  black_id: string | null;
  updated_at: string;
};

type Store = Map<string, Game>;
const globalForChess = globalThis as typeof globalThis & { __nexusGames?: Store };
const games: Store = globalForChess.__nexusGames ?? new Map();
globalForChess.__nexusGames = games;

function json(game: Game | null, status = 200) {
  return NextResponse.json(game, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get('room')?.toUpperCase();
  if (!room) return json(null, 400);
  return json(games.get(room) ?? null, games.has(room) ? 200 : 404);
}

export async function POST(req: Request) {
  const body = await req.json();
  const action = body.action as string;
  const id = String(body.playerId || '');

  if (action === 'create') {
    let room = '';
    do room = Math.random().toString(36).slice(2, 8).toUpperCase(); while (games.has(room));
    const game: Game = {
      room_code: room,
      fen: new Chess().fen(),
      turn: 'white',
      status: 'waiting',
      white_id: id || null,
      black_id: null,
      updated_at: new Date().toISOString(),
    };
    games.set(room, game);
    return json(game, 201);
  }

  if (action === 'join') {
    const room = String(body.room || '').toUpperCase();
    const game = games.get(room);
    if (!game) return json(null, 404);
    if (game.black_id && game.black_id !== id) return NextResponse.json({ error: 'Room is full.' }, { status: 409 });
    if (game.white_id === id) return json({ ...game, status: game.black_id ? game.status : 'waiting' });
    if (!game.black_id) {
      const next = { ...game, black_id: id || null, status: 'playing' as const, updated_at: new Date().toISOString() };
      games.set(room, next);
      return json(next);
    }
    return json(game);
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const room = String(body.room || '').toUpperCase();
  const game = games.get(room);
  if (!game) return json(null, 404);

  if (body.action === 'move') {
    const id = String(body.playerId || '');
    const color = game.white_id === id ? 'white' : game.black_id === id ? 'black' : null;
    if (!color) return NextResponse.json({ error: 'You are not a player in this room.' }, { status: 403 });
    if (game.turn !== color) return NextResponse.json({ error: 'Not your turn.' }, { status: 409 });
    const chess = new Chess(game.fen);
    try {
      chess.move({ from: body.from, to: body.to, promotion: body.promotion || 'q' });
    } catch {
      return NextResponse.json({ error: 'Illegal move.' }, { status: 400 });
    }
    const next: Game = {
      ...game,
      fen: chess.fen(),
      turn: chess.turn() === 'w' ? 'white' : 'black',
      status: chess.isGameOver() ? 'finished' : 'playing',
      updated_at: new Date().toISOString(),
    };
    games.set(room, next);
    return json(next);
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
