// Static three.js scene for leap: camera, lights, sky panorama, scrolling
// river and sandstone riverbanks. No gameplay state — play.js drives it.
import * as T from '../../lib/three.module.min.js';
import { RIVERS, LANE_COUNT } from './rules.js';

function tex(img, repeat) {
  if (!img) return null;
  const t = new T.Texture(img);
  t.needsUpdate = true;
  t.colorSpace = T.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export function buildWorld(assets) {
  const scene = new T.Scene();
  scene.fog = new T.Fog(0x8fd0d8, 55, 150);

  const camera = new T.PerspectiveCamera(58, 1, 0.1, 400);
  const cameraBase = new T.Vector3(0, 3.2, 6.5);
  camera.position.copy(cameraBase);
  camera.lookAt(0, 0.5, -30);

  scene.add(new T.HemisphereLight(0xffe9c2, 0x1c2d3c, 2.6));
  const sun = new T.DirectionalLight(0xffe2b0, 1.5);
  sun.position.set(-8, 14, 6);
  scene.add(sun);

  const skyTextures = {
    jordan: tex(assets['sky-jordan']),
    banias: tex(assets['sky-banias']),
    galilee: tex(assets['sky-galilee']),
  };
  const skyMat = new T.MeshBasicMaterial({ map: skyTextures.jordan, depthWrite: false, fog: false });
  const sky = new T.Mesh(new T.PlaneGeometry(160, 46), skyMat);
  sky.position.set(0, 12, -95);
  scene.add(sky);

  const riverWidth = LANE_COUNT * 1.6 + 1.2;
  const waterTex = tex(assets.water, [2, 20]);
  const river = new T.Mesh(
    new T.PlaneGeometry(riverWidth, 260),
    new T.MeshStandardMaterial({ map: waterTex, color: 0x5bb8c9, roughness: 0.55 }),
  );
  river.rotation.x = -Math.PI / 2;
  river.position.z = -90;
  scene.add(river);

  const bankMat = new T.MeshStandardMaterial({
    map: tex(assets.rock, [3, 46]), color: 0xd7b27a, roughness: 0.95,
  });
  const bankGeo = new T.PlaneGeometry(5, 260);
  for (const side of [-1, 1]) {
    const bank = new T.Mesh(bankGeo, bankMat);
    bank.rotation.x = -Math.PI / 2;
    bank.position.set(side * (riverWidth / 2 + 2.5), 0.02, -90);
    scene.add(bank);
  }

  function setRiverSky(index) {
    skyMat.map = skyTextures[RIVERS[index]] || skyTextures.jordan;
  }

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { scene, camera, cameraBase, waterTex, setRiverSky, resize };
}
