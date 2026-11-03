// Pure rules for falafel (no DOM): timing-quality judging, order generation, scoring.
export const DAYS = 5;

export const QUALITY_MULT = { raw: 0, good: 0.6, perfect: 1, burnt: 0 };

export function judgeTiming(pos) {
  const p = Math.max(0, Math.min(1, pos));
  if (p < 0.3) return 'raw';
  if (p < 0.45) return 'good';
  if (p < 0.72) return 'perfect';
  if (p < 0.85) return 'good';
  return 'burnt';
}

export function qualityMult(quality) {
  return QUALITY_MULT[quality] ?? 0;
}

export function dayConfig(day) {
  const i = Math.max(1, Math.min(DAYS, day)) - 1;
  return {
    falafelNeeded: [2, 2, 3, 3, 4][i],
    patience: [9, 8.2, 7.4, 6.6, 5.8][i],
    markerPeriod: [2.4, 2.1, 1.8, 1.6, 1.4][i],
    tipBase: [10, 12, 14, 16, 18][i],
  };
}

export function genOrder(day, rng = Math.random) {
  const cfg = dayConfig(day);
  let falafel = cfg.falafelNeeded + (rng() < 0.25 ? 1 : 0);
  falafel = Math.max(2, Math.min(5, falafel));
  let tomato = rng() < 0.6;
  let cucumber = rng() < 0.6;
  let tahini = rng() < 0.55;
  if (!tomato && !cucumber && !tahini) tomato = true;
  return { falafel, tomato, cucumber, tahini, tipBase: cfg.tipBase };
}

export function scoreOrder(order, built, opts = {}) {
  const timeLeftRatio = Math.max(0, Math.min(1, opts.timeLeftRatio ?? 0));
  const comboMult = opts.comboMult ?? 1;
  const neededF = order.falafel;
  const gotF = built.falafelCount || 0;
  const avgQual = gotF > 0 ? (built.falafelQualitySum || 0) / gotF : 0;
  const fulfilled = gotF >= neededF;
  let falafelFactor = fulfilled ? avgQual : (gotF / neededF) * avgQual * 0.35;
  const overfillPenalty = Math.max(0, gotF - neededF) * 0.06;
  falafelFactor = Math.max(0, falafelFactor - overfillPenalty);

  let toppingHits = 0;
  const tomatoMatch = !!order.tomato === !!built.tomato;
  const cucumberMatch = !!order.cucumber === !!built.cucumber;
  if (tomatoMatch) toppingHits += 1;
  if (cucumberMatch) toppingHits += 1;
  let tahiniScore;
  if (order.tahini) {
    tahiniScore = built.tahini ? qualityMult(built.tahiniQuality || 'raw') : 0;
  } else {
    tahiniScore = built.tahini ? 0 : 1;
  }
  toppingHits += tahiniScore;
  const toppingFactor = toppingHits / 3;

  const base = order.tipBase ?? 10;
  const raw = base * (0.3 + 0.4 * falafelFactor + 0.3 * toppingFactor) * (1 + 0.3 * timeLeftRatio);
  const tip = Math.round(Math.max(0, raw) * comboMult);
  const perfect = fulfilled && gotF === neededF && toppingFactor === 1 && avgQual >= 0.95;
  return { tip, perfect, falafelFactor, toppingFactor };
}

export function comboMultiplier(streak) {
  return Math.min(1 + Math.max(0, streak) * 0.08, 1.8);
}
