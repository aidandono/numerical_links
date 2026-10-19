import { useRef } from 'react';
import type { Puzzle } from '../core/puzzle';
import { pairColor } from '../game/colors';
import { currentPaths, dragTo, endDrag, startDrag, type GameState } from '../game/state';

const C = 100; // SVG units per cell
const TILE = C - 8; // tile size, leaving a gap between cells
const RADIUS = 14;
const LINE = C * 0.3;
const DOT = C * 0.32;
const OUTLINE = '#2b1d00';
const OUTLINE_W = 7;

interface Props {
  puzzle: Puzzle;
  state: GameState;
  onChange: (s: GameState) => void;
  disabled?: boolean;
}

export default function Board({ puzzle, state, onChange, disabled }: Props) {
  const { width, height, blocked } = puzzle.shape;
  const svgRef = useRef<SVGSVGElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pointerId = useRef<number | null>(null);

  const cellAt = (e: React.PointerEvent): { x: number; y: number } | null => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * height);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    return { x, y };
  };

  const commit = (s: GameState) => {
    stateRef.current = s;
    onChange(s);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled || pointerId.current !== null) return;
    const pos = cellAt(e);
    if (!pos) return;
    const s = startDrag(puzzle, stateRef.current, pos.y * width + pos.x);
    if (s.active === null) return;
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    commit(s);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointerId.current) return;
    const pos = cellAt(e);
    if (!pos) return;
    let s = stateRef.current;
    // Walk one cell at a time towards the pointer so fast drags don't skip cells.
    for (let guard = 0; guard < width + height; guard++) {
      const tail = s.drag[s.drag.length - 1];
      const tx = tail % width;
      const ty = (tail - tx) / width;
      const dx = pos.x - tx;
      const dy = pos.y - ty;
      if (dx === 0 && dy === 0) break;
      const step = Math.abs(dx) >= Math.abs(dy) ? tail + Math.sign(dx) : tail + Math.sign(dy) * width;
      const next = dragTo(puzzle, s, step);
      if (next === s) break;
      s = next;
    }
    if (s !== stateRef.current) commit(s);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointerId.current) return;
    pointerId.current = null;
    commit(endDrag(stateRef.current));
  };

  const paths = currentPaths(state);
  const center = (c: number) => [(c % width) * C + C / 2, Math.floor(c / width) * C + C / 2];

  return (
    <svg
      ref={svgRef}
      className="board"
      viewBox={`0 0 ${width * C} ${height * C}`}
      style={{ aspectRatio: `${width} / ${height}` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {blocked.map((b, c) => {
        if (b) return null;
        const [cx, cy] = center(c);
        return (
          <rect
            key={c}
            x={cx - TILE / 2}
            y={cy - TILE / 2}
            width={TILE}
            height={TILE}
            rx={RADIUS}
            className="cell"
          />
        );
      })}
      {paths.map((path, p) =>
        path.map((c) => {
          const [cx, cy] = center(c);
          return (
            <rect
              key={`t${p}-${c}`}
              x={cx - TILE / 2}
              y={cy - TILE / 2}
              width={TILE}
              height={TILE}
              rx={RADIUS}
              fill={pairColor(p)}
              opacity={0.25}
            />
          );
        }),
      )}
      {paths.map((path, p) => {
        if (path.length < 2) return null;
        const points = path.map((c) => center(c).join(',')).join(' ');
        return (
          <g key={`p${p}`} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <polyline points={points} stroke={OUTLINE} strokeWidth={LINE + OUTLINE_W * 2} />
            <polyline points={points} stroke={pairColor(p)} strokeWidth={LINE} />
          </g>
        );
      })}
      {puzzle.pairs.flatMap(({ a, b }, p) =>
        [a, b].map((c) => {
          const [cx, cy] = center(c);
          const hx = cx - DOT * 0.35;
          const hy = cy - DOT * 0.4;
          return (
            <g key={`e${c}`}>
              <circle cx={cx} cy={cy} r={DOT} fill={pairColor(p)} stroke={OUTLINE} strokeWidth={OUTLINE_W} />
              <ellipse
                cx={hx}
                cy={hy}
                rx={DOT * 0.32}
                ry={DOT * 0.2}
                transform={`rotate(-30 ${hx} ${hy})`}
                fill="#fff"
                opacity={0.6}
              />
            </g>
          );
        }),
      )}
    </svg>
  );
}
