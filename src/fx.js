// Particles: landing dust, crash sparks and finish confetti. One pooled three.js
// Points object, simulated on the CPU (a few hundred particles at most).
import * as THREE from '../vendor/three.module.js';

const MAX = 600;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.p = Array.from({ length: MAX }, () => ({ life: 0 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.PointsMaterial({
      size: 1, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true,
    });
    // Per-particle size (roughly in world units).
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('uniform float size;', 'uniform float size;\nattribute float psize;')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * psize;');
    };
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.next = 0;
    this.attach(scene);
  }

  attach(scene) {
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, color, life, size, gravity = -9, drag = 1.5) {
    const p = this.p[this.next];
    this.next = (this.next + 1) % MAX;
    Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size, gravity, drag });
    p.color = new THREE.Color(color);
  }

  dust(x, y, strength = 1, color = '#e8b07a') {
    const n = Math.round(10 + strength * 14);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI;
      const sp = (1 + Math.random() * 3) * strength;
      this.spawn(x + (Math.random() - 0.5) * 1.2, y + 0.05, (Math.random() - 0.5) * 1.5,
        Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp * 0.6 + 0.4, (Math.random() - 0.5) * 2,
        color, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, -2, 3);
    }
  }

  sparks(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 6;
      this.spawn(x, y, 0.3, Math.cos(a) * sp, Math.sin(a) * sp + 2, (Math.random() - 0.5) * 3,
        Math.random() < 0.5 ? '#ffd23f' : '#ff7b29', 0.4 + Math.random() * 0.4, 0.22, -12, 1);
    }
  }

  confetti(x, y) {
    const colors = ['#ff4d6d', '#ffd23f', '#36c25b', '#3a86ff', '#ffffff', '#ff9f1c'];
    for (let i = 0; i < 140; i++) {
      const a = Math.PI * (0.15 + Math.random() * 0.7), sp = 6 + Math.random() * 9;
      this.spawn(x + (Math.random() - 0.5) * 3, y, (Math.random() - 0.5) * 3,
        Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1), Math.sin(a) * sp, (Math.random() - 0.5) * 4,
        colors[i % colors.length], 1.6 + Math.random(), 0.3, -7, 1.2);
    }
  }

  // Sparkle ring for a PERFECT landing.
  sparkle(x, y) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.spawn(x, y + 0.8, 0.4, Math.cos(a) * 4, Math.sin(a) * 4, 0, '#fff6a8', 0.45, 0.3, 0, 4);
    }
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = this.p[i];
      if (p.life > 0) {
        p.life -= dt;
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vz *= k;
        p.vy = p.vy * k + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const t = Math.max(0, p.life / p.max);
        this.pos[i * 3] = p.x;
        this.pos[i * 3 + 1] = p.y;
        this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = p.color.r;
        this.col[i * 3 + 1] = p.color.g;
        this.col[i * 3 + 2] = p.color.b;
        this.size[i] = p.size * 1.4 * Math.min(1, t * 3);
      } else {
        this.size[i] = 0;
      }
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.psize.needsUpdate = true;
  }
}

// Phone vibration on touch devices, once the player has tapped (browsers refuse it before).
const canBuzz = () => 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches && navigator.userActivation?.hasBeenActive !== false;
export function buzz(ms) {
  if (!canBuzz()) return;
  try { navigator.vibrate(ms); } catch {}
}
