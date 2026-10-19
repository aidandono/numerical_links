import { useCallback, useEffect, useState } from 'react';
import { parseShape, type Shape } from '../core/grid';
import { PRESETS } from '../core/presets';
import type { Puzzle } from '../core/puzzle';
import { randomSeed } from '../core/rng';
import { isSolved } from '../game/state';
import { generateInWorker } from '../worker/client';
import Board from './Board';
import { useGame } from './useGame';

const CUSTOM = 'custom';
const DEFAULT_CUSTOM = ['..........', '..........', '...####...', '..........', '..........'].join('\n');

export default function FreePlay() {
  const [presetId, setPresetId] = useState('rect7');
  const [customText, setCustomText] = useState(DEFAULT_CUSTOM);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const { game, update, undo, reset, canUndo } = useGame(puzzle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildShape = useCallback(
    (seed: number): Shape => {
      if (presetId === CUSTOM) {
        const rows = customText.split('\n').map((r) => r.trimEnd()).filter((r) => r.length > 0);
        return parseShape(rows);
      }
      return PRESETS.find((p) => p.id === presetId)!.make(seed);
    },
    [presetId, customText],
  );

  const newPuzzle = useCallback(async () => {
    const seed = randomSeed();
    let shape: Shape;
    try {
      shape = buildShape(seed);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await generateInWorker(shape, seed);
      if (res.ok) {
        setPuzzle(res.puzzle);
      } else {
        setPuzzle(null);
        setError(res.reason);
      }
      setBusy(false);
    } catch (e) {
      if ((e as Error).message !== 'cancelled') {
        setError((e as Error).message);
        setBusy(false);
      }
    }
  }, [buildShape]);

  useEffect(() => {
    if (presetId !== CUSTOM) void newPuzzle();
    // Regenerate whenever a preset is picked; custom shapes wait for the button.
  }, [presetId]);

  const solved = puzzle && game ? isSolved(puzzle, game) && game.active === null : false;

  return (
    <>
      <div className="controls">
        <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value={CUSTOM}>Custom shape…</option>
        </select>
        <button onClick={() => void newPuzzle()} disabled={busy}>
          {busy ? 'Generating…' : 'New puzzle'}
        </button>
        <button onClick={undo} disabled={!canUndo || busy || solved}>
          Undo
        </button>
        <button onClick={reset} disabled={!puzzle || busy}>
          Reset
        </button>
      </div>

      {presetId === CUSTOM && (
        <div className="custom">
          <label htmlFor="shape">
            One row per line: <code>.</code> open, <code>#</code> blocked
          </label>
          <textarea
            id="shape"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={8}
            spellCheck={false}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="board-wrap">
        {puzzle && game && <Board puzzle={puzzle} state={game} onChange={update} disabled={busy || solved} />}
        {solved && (
          <div className="solved">
            <p>Solved!</p>
            <button onClick={() => void newPuzzle()}>Next puzzle</button>
          </div>
        )}
      </div>
    </>
  );
}
