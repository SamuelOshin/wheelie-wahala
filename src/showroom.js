// The Garage showroom: your bike and rider on a turning stage under a spotlight.
import * as THREE from '../vendor/three.module.js';
import { BikeModel } from './bike.js';
import { Particles } from './fx.js';
import { toon } from './rider.js';

function backdrop() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0a1450');
  grad.addColorStop(0.6, '#1d3bb0');
  grad.addColorStop(1, '#0a1450');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Showroom {
  constructor(style, look) {
    this.scene = new THREE.Scene();
    this.scene.background = backdrop();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    this.scene.add(new THREE.HemisphereLight('#cfe0ff', '#1a1f3a', 1.4));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(2, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 15 });
    this.scene.add(key);

    // The stage: a turning disc on a dark floor, and a soft beam of light from above.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), toon('#141a3a'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.stage = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 0.12, 48), toon('#3a3f52'));
    disc.position.y = -0.06;
    disc.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.04, 8, 64), toon('#ffd23f', { emissive: '#7a5a00' }));
    rim.rotation.x = Math.PI / 2;
    this.stage.add(disc, rim);
    this.scene.add(this.stage);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 7, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: '#9fc3ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    beam.position.y = 3.4;
    this.scene.add(beam);

    this.bike = new BikeModel(style, { look });
    this.bike.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.carrier = new THREE.Group(); // turns with the stage
    this.carrier.add(this.bike.root);
    this.stage.add(this.carrier);
    this.particles = new Particles(this.carrier);
    this.pose();

    this.trail = 'none';
    this.angle = -0.5;
    this.drag = null;
  }

  pose() {
    const t = this.bike.tuning;
    const h = t.wheelRadius - t.rearWheel[1]; // chassis height with wheels on the floor
    const mid = -(t.rearWheel[0] + t.frontWheel[0]) / 2;
    this.bike.update(this.bike.restPose(mid, h));
  }

  setLook(look) {
    this.bike.setLook(look);
    this.bike.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.pose();
  }

  setStyle(style) {
    this.bike.setStyle(style);
    this.pose();
  }

  // Drag to spin the stage; it turns slowly by itself otherwise.
  attach(canvas) {
    canvas.addEventListener('pointerdown', (e) => { if (this.active) this.drag = { x: e.clientX, a: this.angle }; });
    addEventListener('pointermove', (e) => { if (this.drag) this.angle = this.drag.a + (e.clientX - this.drag.x) * 0.01; });
    addEventListener('pointerup', () => (this.drag = null));
  }

  render(renderer, time, dt) {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    this.camera.aspect = w / h;
    // Leave room for the shop panel: bike in the upper part on tall screens, the left on wide ones.
    const wide = w / h > 1.25;
    if (wide) {
      const off = w / h > 1.8 ? 2.9 : 1.9; // phones on their side: the panel is wider
      this.camera.position.set(off, 1.7, 7.6);
      this.camera.lookAt(off, 0.45, 0);
    } else {
      this.camera.position.set(0, 2.3, 9.5);
      this.camera.lookAt(0, -0.9, 0);
    }
    this.camera.updateProjectionMatrix();
    if (!this.drag) this.angle += dt * 0.35;
    this.stage.rotation.y = this.angle;

    // Preview the trail as if riding: puffs stream back from the rear wheel.
    if (this.trail !== 'none') {
      const t = this.bike.tuning;
      const mid = -(t.rearWheel[0] + t.frontWheel[0]) / 2;
      const x = mid + t.rearWheel[0] - 0.3, y = t.wheelRadius * 0.9;
      if (Math.random() < 0.7) this.particles.trail(this.trail, x, y, 6, 0, time);
    }
    this.particles.update(dt);
    renderer.render(this.scene, this.camera);
  }
}
