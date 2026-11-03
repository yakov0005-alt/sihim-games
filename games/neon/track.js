// Builds and re-skins the neon tube + distant backdrop plane. play.js calls
// setTrack() on stage change and update() each frame to scroll the wall
// texture with forward speed, giving the illusion of racing down the tube.
// Also exports the shared radial-geometry constants used by play.js and
// entities.js so the craft, obstacles and pickups all agree on scale.
import * as T from '../../lib/three.module.min.js';

export const TUBE_RADIUS = 6;
export const TUBE_LENGTH = 240;
export const CRAFT_Z = -4;
export const RIDE_MIN_R = 1.05;
export const RIDE_MAX_R = 5.3;

const WALL_NAMES = ['grid', 'circuit', 'decal'];
const WALL_TINTS = [0xffffff, 0x9fe8ff, 0xffd1f5, 0xbfffe8, 0xffe1b0];
const SKY_NAMES = ['tunnel', 'backdrop'];

function tiledTexture(img, repeatX, repeatY) {
  const tex = new T.Texture(img);
  tex.needsUpdate = true;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function planeTexture(img) {
  const tex = new T.Texture(img);
  tex.needsUpdate = true;
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

export function createTrackVisuals({ assets }) {
  const group = new T.Group();

  const wallTextures = WALL_NAMES.map((n) => tiledTexture(assets[n], 4, 16));
  const wallMat = new T.MeshBasicMaterial({ map: wallTextures[0], side: T.BackSide });
  const tube = new T.Mesh(
    new T.CylinderGeometry(TUBE_RADIUS, TUBE_RADIUS, TUBE_LENGTH, 28, 1, true),
    wallMat,
  );
  tube.rotation.x = Math.PI / 2;
  tube.position.z = -(TUBE_LENGTH / 2 - 20);
  group.add(tube);

  const skyTextures = SKY_NAMES.map((n) => planeTexture(assets[n]));
  const skyMat = new T.MeshBasicMaterial({ map: skyTextures[0], side: T.DoubleSide, transparent: true });
  const sky = new T.Mesh(new T.PlaneGeometry(26, 7.2), skyMat);
  sky.position.z = -(TUBE_LENGTH - 26);
  group.add(sky);

  // Faint inner ring of light at the tube mouth so the tunnel reads as a
  // pipe rather than a flat scrolling texture from the very first frame.
  const mouthGlow = new T.Mesh(
    new T.RingGeometry(TUBE_RADIUS * 0.15, TUBE_RADIUS * 1.02, 32),
    new T.MeshBasicMaterial({ color: 0x3df3ff, transparent: true, opacity: 0.08, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }),
  );
  mouthGlow.position.z = 1.5;
  group.add(mouthGlow);

  function setTrack(index) {
    wallMat.map = wallTextures[index % wallTextures.length];
    wallMat.color.setHex(WALL_TINTS[index % WALL_TINTS.length]);
    wallMat.needsUpdate = true;
    skyMat.map = skyTextures[index % skyTextures.length];
    skyMat.needsUpdate = true;
    mouthGlow.material.color.setHex(WALL_TINTS[index % WALL_TINTS.length]);
  }

  function update(dt, speed) {
    const scroll = dt * speed * 0.045;
    for (const tex of wallTextures) tex.offset.y -= scroll;
  }

  return { group, setTrack, update };
}
