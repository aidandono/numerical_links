const KEY = 'numerical-links:progress:v1';

/** Solved level ids. */
export type Progress = Record<string, true>;

export function loadProgress(): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    // Older saves stored best times per id; any entry means solved.
    return Object.fromEntries(Object.keys(parsed).map((id) => [id, true]));
  } catch {
    return {};
  }
}

/** Mark a level solved. Returns the updated progress. */
export function recordSolve(progress: Progress, id: string): Progress {
  if (progress[id]) return progress;
  const next: Progress = { ...progress, [id]: true };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, blocked): progress lasts for this visit only.
  }
  return next;
}
