// The leaping fish itself: a shaded 3D body (fish-skin material) with the
// trimmed fish sprite layered on top for a crisp silhouette. Pure visuals —
// play.js drives lane/jump/spin state on the returned group.
import * as T from '../../lib/three.module.min.js';
import { laneX } from './rules.js';

export const BASE_Y = 0.42;

function tex(img) {
  if (!img) return null;
  const t = new T.Texture(img);
  t.needsUpdate = true;
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

export function createFish(assets) {
  const group = new T.Group();

  const bodyMat = new T.MeshStandardMaterial({
    map: tex(assets['fish-skin']), color: 0xffd98a, roughness: 0.35, metalness: 0.2,
  });
  const body = new T.Mesh(new T.CapsuleGeometry(0.2, 0.5, 4, 8), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0, -0.05);
  group.add(body);

  const spriteMat = new T.MeshBasicMaterial({ map: tex(assets.fish), transparent: true });
  const sprite = new T.Mesh(new T.PlaneGeometry(1.15, 0.66), spriteMat);
  sprite.position.z = 0.1;
  group.add(sprite);

  group.position.set(laneX(1), BASE_Y, 0);
  return { group };
}
