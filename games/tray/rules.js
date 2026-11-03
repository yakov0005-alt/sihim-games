// Pure rules for "tray" (מגש הפירות) — no DOM. Imported by game.js and unit-tested by qa/rules/tray.test.mjs.

export const FRUITS = ['pomegranate', 'orange', 'lemon', 'grape', 'olive'];

// Levels ramp kinds (distinct fruit types in play), how many fruit can be on
// the tray at once, how many trio-clears are needed to pass, and the time budget.
export const LEVELS = [
  { kinds: 3, maxFruit: 9, goal: 5, time: 50 },
  { kinds: 3, maxFruit: 10, goal: 6, time: 55 },
  { kinds: 4, maxFruit: 11, goal: 7, time: 60 },
  { kinds: 4, maxFruit: 12, goal: 8, time: 65 },
  { kinds: 5, maxFruit: 13, goal: 10, time: 75 },
];

export function getLevel(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}

// balls: [{id, type, x, y, r}]. Returns connected components of touching
// same-type balls as [{type, ids:[...]}], including singletons (caller filters by size).
export function findClusters(balls, slack = 0.08) {
  const parent = new Map();
  const find = (id) => { let r = id; while (parent.get(r) !== r) r = parent.get(r); let c = id; while (parent.get(c) !== c) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const b of balls) parent.set(b.id, b.id);
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if (a.type !== b.type) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d <= a.r + b.r + slack) union(a.id, b.id);
    }
  }
  const groups = new Map();
  for (const b of balls) {
    const root = find(b.id);
    if (!groups.has(root)) groups.set(root, { type: b.type, ids: [] });
    groups.get(root).ids.push(b.id);
  }
  return [...groups.values()];
}

export function matchesFromClusters(clusters, minSize = 3) {
  return clusters.filter((c) => c.ids.length >= minSize);
}

// Bigger clusters score extra per fruit above 3; chains (multiple clears in
// one cascade) multiply the next clear's score.
export function scoreForCluster(size, chainIndex = 0) {
  const base = size * 10 + Math.max(0, size - 3) * 5;
  const mult = 1 + chainIndex * 0.5;
  return Math.round(base * mult);
}

export function isLevelComplete(level, clears) {
  return clears >= level.goal;
}

// counts: per-type active-on-tray counts (index-aligned with FRUITS), kinds:
// how many types are unlocked this level. Picks the least-populous type so
// the tray stays balanced and trios stay reachable; ties broken by `rand` (0..1).
export function pickSpawnType(counts, kinds, rand = Math.random()) {
  let min = Infinity;
  for (let i = 0; i < kinds; i++) if (counts[i] < min) min = counts[i];
  const tied = [];
  for (let i = 0; i < kinds; i++) if (counts[i] === min) tied.push(i);
  return tied[Math.min(tied.length - 1, Math.floor(rand * tied.length))];
}
