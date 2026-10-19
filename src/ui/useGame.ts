import { useRef, useState } from 'react';
import type { Puzzle } from '../core/puzzle';
import { initialState, type GameState } from '../game/state';

const sameBase = (a: number[][], b: number[][]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Game state for a puzzle with an undo history. Each finished drag that
 * changed the board (and each reset) is one undo step. History clears when
 * the puzzle changes.
 */
export function useGame(puzzle: Puzzle | null) {
  const [game, setGame] = useState<GameState | null>(() => puzzle && initialState(puzzle));
  const [history, setHistory] = useState<number[][][]>([]);
  const [forPuzzle, setForPuzzle] = useState(puzzle);
  const gameRef = useRef(game);
  const dragStart = useRef<number[][] | null>(null);

  if (puzzle !== forPuzzle) {
    const fresh = puzzle && initialState(puzzle);
    setForPuzzle(puzzle);
    setGame(fresh);
    setHistory([]);
    gameRef.current = fresh;
    dragStart.current = null;
  }

  const update = (s: GameState) => {
    const prev = gameRef.current;
    if (prev?.active === null && s.active !== null) dragStart.current = prev.base;
    if (s.active === null && dragStart.current) {
      const before = dragStart.current;
      dragStart.current = null;
      if (!sameBase(before, s.base)) setHistory((h) => [...h, before]);
    }
    gameRef.current = s;
    setGame(s);
  };

  const commitBase = (base: number[][]) => {
    const s = { base, active: null, drag: [] };
    gameRef.current = s;
    setGame(s);
  };

  const undo = () => {
    if (history.length === 0) return;
    commitBase(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  const reset = () => {
    const cur = gameRef.current;
    if (!puzzle || !cur || cur.base.every((p) => p.length === 0)) return;
    setHistory((h) => [...h, cur.base]);
    commitBase(initialState(puzzle).base);
  };

  return { game, update, undo, reset, canUndo: history.length > 0 };
}
