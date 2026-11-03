// Pure rules for "shore" (חופית בחוף) — no DOM. Imported by game.js and
// unit-tested by qa/rules/shore.test.mjs.
//
// The tide is a single scalar "edge": the distance from the shoreline (x=0,
// always safe) out to the current water line. When the tide is out, edge is
// large and sand is exposed, so shells/crabs spawn and the bird can run out
// to peck them for points. As the tide comes back in, edge shrinks; any item
// left past the new edge is swept away, and if the bird itself is caught
// past the edge it loses a life and its peck combo. A seeded RNG lets a
// "daily" run (seeded from the date) reproduce the same spawn pattern.

export const LIVES_START = 3;
export const PECK_RANGE = 18; // max distance between bird and item to peck it
export const COMBO_STEP = 0.12; // +12% score per consecutive peck, no wave hit
export const MAX_COMBO_FOR_BONUS = 12;

export const ITEMS = {
  shell: { value: 15 },
  crab: { value: 30 },
};

// Three stages: tide swings farther out and cycles faster as it ramps up.
export const LEVELS = [
  { name: 'בריכת סלעים', tideMin: 40, tideMax: 160, period: 6, spawnEvery: 1.4, goal: 300 },
  { name: 'שרטון חול', tideMin: 40, tideMax: 220, period: 5, spawnEvery: 1.1, goal: 700 },
  { name: 'שונית', tideMin: 40, tideMax: 280, period: 4, spawnEvery: 0.9, goal: 1300 },
];

export function getLevel(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}

// --- seeded RNG (mulberry32), so a daily seed reproduces the same run ---
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// dateStr like '2026-11-03' -> deterministic 32-bit seed (FNV-1a hash).
export function dailySeed(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createState(seed = 1) {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    lives: LIVES_START,
    stage: 0,
    t: 0,
    nextSpawn: 0,
    nextId: 1,
    items: [],
    rng: mulberry32(seed),
  };
}

// Sinusoidal tide: edge oscillates between level.tideMin and level.tideMax.
export function tideEdge(t, level) {
  const mid = (level.tideMin + level.tideMax) / 2;
  const amp = (level.tideMax - level.tideMin) / 2;
  return mid + amp * Math.sin((2 * Math.PI * t) / level.period);
}

export function isExposed(item, edge) {
  return item.x <= edge;
}

export function isSubmerged(item, edge) {
  return item.x > edge;
}

export function pickItemType(rng) {
  return rng() < 0.65 ? 'shell' : 'crab';
}

// Spawns within the currently exposed sand only (up to maxX, default the
// level's full low-tide reach), so an item never appears already underwater.
export function spawnItem(state, level, maxX = level.tideMax) {
  const type = pickItemType(state.rng);
  const hi = Math.max(level.tideMin, maxX);
  const x = level.tideMin + state.rng() * (hi - level.tideMin);
  const item = { id: state.nextId++, type, x, value: ITEMS[type].value };
  state.items.push(item);
  return item;
}

// Advances tide time, spawns new items on schedule, sweeps away anything the
// incoming water has now covered. Returns the current tide edge.
export function updateTide(state, level, dt) {
  state.t += dt;
  const edge = tideEdge(state.t, level);
  state.nextSpawn -= dt;
  if (state.nextSpawn <= 0) {
    spawnItem(state, level, edge);
    state.nextSpawn += level.spawnEvery;
  }
  state.items = state.items.filter((it) => !isSubmerged(it, edge));
  return edge;
}

export function comboMultiplier(combo) {
  return 1 + Math.min(combo, MAX_COMBO_FOR_BONUS) * COMBO_STEP;
}

export function canPeck(item, birdX, edge) {
  if (!item) return false;
  if (!isExposed(item, edge)) return false;
  return Math.abs(birdX - item.x) <= PECK_RANGE;
}

// Resolves a peck attempt on a specific item by id. Mutates state on success.
export function performPeck(state, itemId, birdX, edge) {
  const idx = state.items.findIndex((it) => it.id === itemId);
  if (idx === -1) return { outcome: 'gone', points: 0 };
  const item = state.items[idx];
  if (!canPeck(item, birdX, edge)) {
    return { outcome: isExposed(item, edge) ? 'tooFar' : 'submerged', points: 0 };
  }
  const points = Math.round(item.value * comboMultiplier(state.combo));
  state.items.splice(idx, 1);
  state.score += points;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  return { outcome: 'pecked', points };
}

// The bird is caught if it is standing past the current tide edge (the wave
// has flowed over its position). Costs a life and resets the combo.
export function checkWaveHit(state, birdX, edge) {
  if (birdX <= edge) return { outcome: 'safe' };
  state.lives = Math.max(0, state.lives - 1);
  state.combo = 0;
  return { outcome: 'hit', lives: state.lives };
}

export function stageComplete(level, score) {
  return score >= level.goal;
}

export function isGameOver(state) {
  return state.lives <= 0;
}
