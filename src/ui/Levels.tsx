import { useEffect, useState } from 'react';
import { isSolved } from '../game/state';
import { loadPack, PACKS, type Level, type Pack } from '../levels/levels';
import { loadProgress, recordSolve, type Progress } from '../levels/progress';
import Board from './Board';
import { useGame } from './useGame';

const PAGE_SIZE = 30;

const solvedCount = (pack: Pack, progress: Progress) => pack.levelIds.filter((id) => progress[id]).length;

/** Index of the first unsolved level (or the last level if all are solved). */
const firstUnsolved = (pack: Pack, progress: Progress) => {
  const i = pack.levelIds.findIndex((id) => !progress[id]);
  return i === -1 ? pack.levelIds.length - 1 : i;
};

export default function Levels() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [packId, setPackId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [index, setIndex] = useState<number | null>(null);
  const [levels, setLevels] = useState<Level[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pack = PACKS.find((p) => p.id === packId) ?? null;

  useEffect(() => {
    if (!packId) return;
    let live = true;
    setLevels(null);
    setError(null);
    loadPack(packId).then(
      (l) => live && setLevels(l),
      () => live && setError('Could not load this pack.'),
    );
    return () => {
      live = false;
    };
  }, [packId]);

  const openPack = (p: Pack) => {
    setPackId(p.id);
    setPage(Math.floor(firstUnsolved(p, progress) / PAGE_SIZE));
    setIndex(null);
  };

  const play = (i: number) => {
    setIndex(i);
    setPage(Math.floor(i / PAGE_SIZE));
  };

  if (!pack) return <PackList progress={progress} onOpen={openPack} />;

  if (index !== null && levels) {
    const backToPack = () => setIndex(null);
    return (
      <LevelPlay
        key={index}
        level={levels[index]}
        pack={pack}
        onBack={backToPack}
        onPrev={index > 0 ? () => play(index - 1) : undefined}
        onNext={index < levels.length - 1 ? () => play(index + 1) : undefined}
        onSolved={() => setProgress((p) => recordSolve(p, levels[index].id))}
      />
    );
  }

  const pages = Math.ceil(pack.levelIds.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const done = solvedCount(pack, progress);

  return (
    <div className="pack-view">
      <div className="controls">
        <button onClick={() => setPackId(null)}>← Packs</button>
        <button onClick={() => play(firstUnsolved(pack, progress))} disabled={!levels}>
          Continue
        </button>
      </div>
      <h2 className="pack-title">
        {pack.label} <span className="muted">· {done}/{pack.levelIds.length}</span>
      </h2>
      {!levels && !error && <p className="muted loading">Loading…</p>}
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="level-grid">
          {pack.levelIds.slice(start, start + PAGE_SIZE).map((id, k) => {
            const i = start + k;
            return (
              <button
                key={id}
                className={`level-btn${progress[id] ? ' done' : ''}`}
                onClick={() => play(i)}
                disabled={!levels}
                aria-label={`Level ${i + 1}${progress[id] ? ', solved' : ''}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}
      {pages > 1 && (
        <div className="pager">
          <button onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Previous page">
            ◀
          </button>
          <span>
            Page {page + 1} / {pages}
          </span>
          <button onClick={() => setPage(page + 1)} disabled={page === pages - 1} aria-label="Next page">
            ▶
          </button>
        </div>
      )}
    </div>
  );
}

function PackList({ progress, onOpen }: { progress: Progress; onOpen: (p: Pack) => void }) {
  return (
    <div className="pack-grid">
      {PACKS.map((p) => {
        const done = solvedCount(p, progress);
        const total = p.levelIds.length;
        return (
          <button key={p.id} className={`pack-card${done === total ? ' complete' : ''}`} onClick={() => onOpen(p)}>
            <span className="pack-name">{p.label}</span>
            <span className="pack-count">
              {done}/{total}
            </span>
            <span className="pack-bar">
              <span style={{ width: `${(done / total) * 100}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface PlayProps {
  level: Level;
  pack: Pack;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSolved: () => void;
}

function LevelPlay({ level, pack, onBack, onPrev, onNext, onSolved }: PlayProps) {
  const { puzzle } = level;
  const { game, update, undo, reset, canUndo } = useGame(puzzle);
  const solved = isSolved(puzzle, game!) && game!.active === null;

  useEffect(() => {
    if (solved) onSolved();
  }, [solved]);

  return (
    <>
      <div className="controls">
        <button onClick={onBack}>← Levels</button>
        <button onClick={undo} disabled={!canUndo || solved}>
          Undo
        </button>
        <button onClick={reset} disabled={solved}>
          Reset
        </button>
        <button onClick={onPrev} disabled={!onPrev} aria-label="Previous level">
          ◀
        </button>
        <button onClick={onNext} disabled={!onNext} aria-label="Next level">
          ▶
        </button>
      </div>
      <div className="level-info">
        {pack.label} · Level {level.number}
      </div>

      <div className="board-wrap">
        <Board puzzle={puzzle} state={game!} onChange={update} disabled={solved} />
        {solved && (
          <div className="solved">
            <p>Solved!</p>
            {onNext ? <button onClick={onNext}>Next level</button> : <button onClick={onBack}>Back to pack</button>}
          </div>
        )}
      </div>
    </>
  );
}
