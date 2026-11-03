// Endless track/camera model for the skate runner: no DOM, world units == screen px
// (minus a scrolling offset), so play.js/render.js never need a separate scale factor.
import { isOverRamp } from './rules.js';

export const GROUND_Y = 0.8; // ground baseline, fraction of canvas height
export const PLAYER_SCREEN_X = 0.3; // player's fixed screen position, fraction of width
export const BASE_SPEED = 230; // world units/sec at stage 0
export const RAMP_STYLES = ['ramp-wood', 'ramp-stone'];
export const AHEAD_BUFFER = 2600; // keep ramps generated this far past the player
export const BEHIND_BUFFER = 700; // prune ramps once this far behind the player

export function speedForStage(stage) {
  return BASE_SPEED + stage * 35;
}

// Shorter cycles on later stages make good gust timing harder to land.
export function gustPeriodForStage(stage) {
  return 1.35 - stage * 0.12;
}

export function worldToScreenX(worldX, playerWorldX, w) {
  return worldX - playerWorldX + w * PLAYER_SCREEN_X;
}

export function createTrack() {
  const first = { x: -40, width: 190, style: 'ramp-wood' };
  return { ramps: [first], cursor: first.x + first.width, flip: false };
}

// Ramps cover most of the track (wide plateaus, short sand gaps) so standing
// over one — and clearing the gap to the next after a minimum-power launch —
// is the common case. The real risk is unresolved spin, not raw distance.
function pushRamp(track) {
  const gap = 70 + Math.random() * 110;
  const width = 170 + Math.random() * 160;
  const x = track.cursor + gap;
  track.flip = !track.flip;
  track.ramps.push({ x, width, style: RAMP_STYLES[track.flip ? 1 : 0] });
  track.cursor = x + width;
}

export function updateTrack(track, playerWorldX) {
  while (track.cursor < playerWorldX + AHEAD_BUFFER) pushRamp(track);
  while (track.ramps.length > 2 && track.ramps[1].x + track.ramps[1].width < playerWorldX - BEHIND_BUFFER) {
    track.ramps.shift();
  }
}

export function rampAt(track, worldX) {
  return track.ramps.find((r) => isOverRamp(worldX, r)) || null;
}
