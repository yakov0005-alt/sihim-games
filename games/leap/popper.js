// Tiny billboard "stamp" popper: a one-shot image (splash droplet, trick
// twist icon) that rises, grows slightly and fades. Used by play.js for the
// splash-on-jump/land and trick-landed flourishes.
import * as T from '../../lib/three.module.min.js';

function tex(img) {
  if (!img) return null;
  const t = new T.Texture(img);
  t.needsUpdate = true;
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

export function makePopper(scene, img, w, h) {
  const mat = new T.MeshBasicMaterial({ map: tex(img), transparent: true, depthTest: false });
  const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, t: 0, dur: 0.001 };
}

export function firePopper(p, pos, dur = 0.5) {
  p.mesh.position.copy(pos);
  p.mesh.position.y += 0.55;
  p.mesh.visible = true;
  p.mesh.material.opacity = 1;
  p.mesh.scale.setScalar(1);
  p.t = 0; p.dur = dur;
}

export function updatePopper(p, dt) {
  if (!p.mesh.visible) return;
  p.t += dt;
  const k = p.t / p.dur;
  p.mesh.position.y += dt * 0.6;
  p.mesh.material.opacity = Math.max(0, 1 - k);
  p.mesh.scale.setScalar(1 + k * 0.4);
  if (p.t >= p.dur) p.mesh.visible = false;
}
