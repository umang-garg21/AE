// Interactive 3D thrust-chamber model for the site (three.js, no build step).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- engine profile: s = 0 (injector face) .. 4 (nozzle exit); y = TOP - s ----
const TOP = 1.6, SMAX = 4.0, S_THROAT = 1.95, S_JOIN = 2.25;
export function radius(s) {
  if (s < 1.4) return 0.55;
  if (s < S_THROAT) { const t = (s - 1.4) / (S_THROAT - 1.4); return 0.22 + 0.33 * (0.5 + 0.5 * Math.cos(Math.PI * t)); }
  const t = (s - S_THROAT) / (SMAX - S_THROAT); return 0.22 + 0.80 * (1 - Math.pow(1 - t, 2.3));
}
const yOf = s => TOP - s;
const EXIT_Y = yOf(SMAX), EXIT_R = radius(SMAX);

const GLSL_NOISE = `
float h3(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
vec3 cmap(float t){t=clamp(t,0.,1.);return clamp(vec3(1.5-abs(4.*t-3.),1.5-abs(4.*t-2.),1.5-abs(4.*t-1.)),0.,1.);}
`;

function lathe(sFrom, sTo, offset, n = 90, seg = 96) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const s = sFrom + (sTo - sFrom) * i / n; pts.push(new THREE.Vector2(radius(s) + offset, yOf(s))); }
  return new THREE.LatheGeometry(pts, seg);
}
function spriteTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}

export function createEngineView(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
  scene.fog = new THREE.FogExp2(0x0a0605, 0.045);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(6.2, 0.8, 12.5);
  const target = new THREE.Vector3(0, -0.9, 0);

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0x8899aa, 0x120806, 0.35));
  const key = new THREE.DirectionalLight(0xfff1e0, 1.6); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fd6ff, 1.6); rim.position.set(-5, 2, -4); scene.add(rim);
  const fire = new THREE.PointLight(0xff7a2a, 0, 14, 1.6); fire.position.set(0, EXIT_Y - 0.8, 0); scene.add(fire);

  // ---- section-cut plane (always faces the camera) ----
  const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 50);
  const clip = [cut];

  // ---- materials ----
  const copper = new THREE.MeshPhysicalMaterial({ color: 0xc27a4a, metalness: 1, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.4, clippingPlanes: clip, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.38, clippingPlanes: clip, side: THREE.DoubleSide });
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xb5a493, metalness: 1, roughness: 0.3, clippingPlanes: clip });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3532, metalness: 0.9, roughness: 0.45, clippingPlanes: clip });
  const accent = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, metalness: 1, roughness: 0.22, clippingPlanes: clip });

  const U = { uTime: { value: 0 }, uIgnite: { value: 0 }, uSec: { value: 0 } };
  const heatMat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide, clipping: true, clippingPlanes: clip,
    vertexShader: `#include <clipping_planes_pars_vertex>
      varying float vS; varying vec3 vP;
      void main(){ vS = uv.y*${SMAX.toFixed(1)}; vP=position; vec4 mvPosition = modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mvPosition;
      #include <clipping_planes_vertex>
      }`,
    fragmentShader: `#include <clipping_planes_pars_fragment>
      uniform float uTime,uIgnite,uSec; varying float vS; varying vec3 vP; ${GLSL_NOISE}
      void main(){
        #include <clipping_planes_fragment>
        float s=vS; float T = s<${S_THROAT.toFixed(2)} ? mix(.55,1.,exp(-pow((s-${S_THROAT.toFixed(2)})/.5,2.))) : .12+.88*exp(-(s-${S_THROAT.toFixed(2)})/.8);
        T += .04*sin(s*18.-uTime*6.) + .05*(fbm(vec3(vP*4.)+uTime*.6)-.5);
        vec3 cfd = cmap(T);
        vec3 base = vec3(.11,.09,.08);
        vec3 col = mix(base, cfd, uSec);
        col += uIgnite*vec3(1.,.42,.12)*pow(T,2.)*1.6;
        gl_FragColor = vec4(col,1.);
      }`
  });

  // ---- geometry ----
  const engine = new THREE.Group(); scene.add(engine);
  const parts = {}; // name -> {obj, explode: Vector3}
  const add = (name, obj, ex) => { engine.add(obj); parts[name] = { obj, base: obj.position.clone(), ex }; return obj; };

  // chamber (copper, regen cooled)
  const chamber = new THREE.Group();
  chamber.add(new THREE.Mesh(lathe(0, S_JOIN, 0.035), copper));
  chamber.add(new THREE.Mesh(lathe(0, S_JOIN, 0.0), heatMat));
  // regen channel ribs on chamber
  { const g = []; for (let k = 0; k < 72; k++) { const th = k / 72 * Math.PI * 2; const pts = [];
      for (let i = 0; i <= 40; i++) { const s = 0.05 + (S_JOIN - 0.1) * i / 40; const r = radius(s) + 0.042; pts.push(new THREE.Vector3(r * Math.cos(th), yOf(s), r * Math.sin(th))); }
      g.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.009, 4, false)); }
    chamber.add(new THREE.Mesh(mergeGeometries(g), copper)); }
  add('chamber', chamber, new THREE.Vector3(0, 0, 0));

  // nozzle extension: tube-wall bundle + inner hot wall
  const nozzle = new THREE.Group();
  nozzle.add(new THREE.Mesh(lathe(S_JOIN - 0.02, SMAX, 0.0), heatMat));
  nozzle.add(new THREE.Mesh(lathe(S_JOIN - 0.02, SMAX, 0.012), steel));
  { const g = []; const N = 120; for (let k = 0; k < N; k++) { const th = k / N * Math.PI * 2; const pts = [];
      for (let i = 0; i <= 50; i++) { const s = S_JOIN + (SMAX - S_JOIN) * i / 50; const r = radius(s) + 0.03; pts.push(new THREE.Vector3(r * Math.cos(th), yOf(s), r * Math.sin(th))); }
      g.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 50, 0.024, 5, false)); }
    nozzle.add(new THREE.Mesh(mergeGeometries(g), tubeMat)); }
  for (const s of [2.75, 3.3, 3.85]) { const t = new THREE.Mesh(new THREE.TorusGeometry(radius(s) + 0.07, 0.028, 10, 120), steel); t.rotation.x = Math.PI / 2; t.position.y = yOf(s); nozzle.add(t); }
  { const t = new THREE.Mesh(new THREE.TorusGeometry(EXIT_R + 0.08, 0.06, 14, 140), accent); t.rotation.x = Math.PI / 2; t.position.y = EXIT_Y + 0.03; nozzle.add(t); }
  add('nozzle', nozzle, new THREE.Vector3(0, -1.1, 0));

  // throat / coolant manifold
  const manifold = new THREE.Mesh(new THREE.TorusGeometry(radius(S_JOIN) + 0.13, 0.085, 16, 120), accent);
  manifold.rotation.x = Math.PI / 2; manifold.position.y = yOf(S_JOIN);
  add('manifold', manifold, new THREE.Vector3(0, -0.55, 0));

  // injector head + dome + gimbal
  const head = new THREE.Group();
  { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.62, 0.28, 64), steel); c.position.y = TOP + 0.14; head.add(c);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.58, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), dark); d.scale.y = 0.55; d.position.y = TOP + 0.28; head.add(d);
    for (let k = 0; k < 16; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), accent); const th = k / 16 * Math.PI * 2; b.position.set(0.62 * Math.cos(th), TOP + 0.3, 0.62 * Math.sin(th)); head.add(b); }
    const gb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.42, 32), accent); gb.position.y = TOP + 0.72; head.add(gb);
    const gp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), dark); gp.position.y = TOP + 0.96; head.add(gp); }
  add('head', head, new THREE.Vector3(0, 1.0, 0));

  // turbopumps + feed lines
  function pump(side) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.95, 40), side > 0 ? copper : steel); g.add(body);
    for (const yy of [-0.36, 0, 0.36]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.025, 8, 40), dark); r.rotation.x = Math.PI / 2; r.position.y = yy; g.add(r); }
    const vol = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.09, 14, 40), accent); vol.position.y = -0.55; vol.rotation.x = Math.PI / 2; g.add(vol);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), dark); cap.position.y = 0.47; g.add(cap);
    g.position.set(side * 1.15, TOP - 0.55, 0.15); g.rotation.z = side * 0.12;
    return g;
  }
  const pA = add('pumpA', pump(1), new THREE.Vector3(1.0, 0.25, 0.2));
  const pB = add('pumpB', pump(-1), new THREE.Vector3(-1.0, 0.25, 0.2));
  // feed lines (follow pumps when exploded via being children)
  function line(pts, r, mat, parent) { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 60, r, 12, false), mat); parent.add(m); }
  line([[0, -0.55, 0], [-0.25, -0.9, 0], [-0.75, -1.2, -0.05], [-1.0, -1.6, -0.12]], 0.07, steel, pA);
  line([[0, -0.55, 0], [0.25, -0.9, 0], [0.75, -1.2, -0.05], [1.0, -1.6, -0.12]], 0.07, steel, pB);
  line([[0, 0.5, 0], [-0.2, 0.9, 0], [-0.7, 1.05, -0.1], [-1.05, 0.95, -0.1]], 0.05, accent, pA);
  line([[0, 0.5, 0], [0.2, 0.9, 0], [0.7, 1.05, -0.1], [1.05, 0.95, -0.1]], 0.05, accent, pB);

  // ---- plume (bloom-lit) ----
  const L = 7.0;
  const plumeGeo = new THREE.CylinderGeometry(EXIT_R * 0.93, EXIT_R * 2.4, L, 64, 80, true); plumeGeo.translate(0, -L / 2, 0);
  const plumeMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vUv=uv; vP=position; vec4 w=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime,uIgnite; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vP; ${GLSL_NOISE}
      void main(){
        float a = 1.-vUv.y;                      // 0 at exit -> 1 far
        float n = fbm(vec3(vP.x*2.2, vP.y*1.4+uTime*9., vP.z*2.2));
        float core = pow(1.-a, 2.4);
        float diamonds = pow(.5+.5*cos(a*${L.toFixed(1)}*3.1), 8.)*pow(1.-a,1.4);
        float facing = pow(abs(dot(vN,vV)), 2.2);
        vec3 col = mix(vec3(1.,.36,.08), vec3(1.,.93,.78), clamp(core*1.4+diamonds,0.,1.));
        float alpha = (core*.85 + diamonds*.9 + .12*(1.-a)) * facing * (.55+.75*n) * uIgnite;
        gl_FragColor = vec4(col, alpha*.55);
      }`
  });
  const plume = new THREE.Mesh(plumeGeo, plumeMat); plume.position.y = EXIT_Y; engine.add(plume);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(EXIT_R * 0.55, EXIT_R * 0.9, L * 0.6, 48, 40, true).translate(0, -L * 0.3, 0), plumeMat); inner.position.y = EXIT_Y; engine.add(inner);
  // Mach disks
  const diskMat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 w=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uIgnite,uTime; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(vN,vV)),3.); gl_FragColor=vec4(vec3(1.,.9,.75)*1.8, f*uIgnite*(.75+.25*sin(uTime*60.))); }` });
  const disks = [];
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), diskMat); const r = EXIT_R * (0.62 - k * 0.1); m.scale.set(r, r * 0.55, r); m.position.y = EXIT_Y - (1.0 + k * 1.02); engine.add(m); disks.push(m); }
  // exhaust particles
  const NP = 1800, pPos = new Float32Array(NP * 3), pLife = new Float32Array(NP), pVel = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.16, map: spriteTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const exhaust = new THREE.Points(pGeo, pMat); engine.add(exhaust);
  function respawn(i) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * EXIT_R * 0.9; pPos[i * 3] = r * Math.cos(a); pPos[i * 3 + 1] = EXIT_Y - Math.random() * 0.2; pPos[i * 3 + 2] = r * Math.sin(a);
    pVel[i * 3] = pPos[i * 3] * 0.6 + (Math.random() - .5) * .3; pVel[i * 3 + 1] = -(6 + Math.random() * 5); pVel[i * 3 + 2] = pPos[i * 3 + 2] * 0.6 + (Math.random() - .5) * .3; pLife[i] = Math.random(); }
  for (let i = 0; i < NP; i++) respawn(i);

  // ---- internal flow particles (CFD look, visible in section) ----
  const NF = 3200, fPos = new Float32Array(NF * 3), fCol = new Float32Array(NF * 3), fS = new Float32Array(NF), fR = new Float32Array(NF);
  const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  const fMat = new THREE.PointsMaterial({ size: 0.07, map: spriteTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const flow = new THREE.Points(fGeo, fMat); engine.add(flow);
  for (let i = 0; i < NF; i++) { fS[i] = Math.random() * SMAX; fR[i] = (Math.random() * 2 - 1) * 0.92; }
  const jet = t => [Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 3))), Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 2))), Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 1)))];

  // ---- backdrop: floor grid + faint stand beams ----
  const grid = new THREE.GridHelper(40, 80, 0x3a2a22, 0x1d1411); grid.position.y = EXIT_Y - 2.6; grid.material.transparent = true; grid.material.opacity = 0.55; scene.add(grid);

  // ---- callouts (HTML) ----
  const labels = [];
  function label(text, local, parent, group = 'cad') { const el = document.createElement('div'); el.className = 'callout'; el.dataset.group = group; el.innerHTML = `<em></em><i></i><span>${text}</span>`; (opts.labelLayer || canvas.parentElement).appendChild(el); labels.push({ el, local: new THREE.Vector3(...local), parent }); return el; }
  if (opts.labels !== false) {
    label('Regen-cooled chamber · CuCrZr', [radius(0.8) + 0.05, yOf(0.8), 0.0], chamber, 'cad');
    label('Throat · Ø 44.0 mm', [radius(S_THROAT) + 0.04, yOf(S_THROAT), 0], chamber, 'cad');
    label('Tube-wall nozzle · 120 tubes', [radius(3.2) + 0.05, yOf(3.2), 0], nozzle, 'cad');
    label('Turbopump · LOX', [0.25, 0.2, 0], pA, 'parts');
    label('Turbopump · fuel', [-0.25, 0.2, 0], pB, 'parts');
    label('Injector · 312 elements', [0.6, TOP + 0.2, 0], head, 'parts');
    label('Coolant manifold', [radius(S_JOIN) + 0.2, yOf(S_JOIN), 0], manifold, 'parts');
    label('Wall temperature · CFD', [0, yOf(1.2), -radius(1.2)], chamber, 'cfd');
    label('Throat · peak heat flux', [-radius(S_THROAT), yOf(S_THROAT), -0.05], chamber, 'cfd');
  }

  // ---- post ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.25, 0.4, 0.88); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- controls ----
  let controls = null;
  if (opts.interactive) {
    controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.enableZoom = false; controls.enablePan = false;
    controls.target.copy(target); controls.minPolarAngle = 0.5; controls.maxPolarAngle = 2.2; controls.autoRotate = true; controls.autoRotateSpeed = 0.7;
    canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; clearTimeout(canvas._ar); });
    canvas.addEventListener('pointerup', () => { canvas._ar = setTimeout(() => controls.autoRotate = true, 4000); });
  }

  // ---- state ----
  const state = { ignite: 0, section: 0, explode: 0, labels: 'cad' }, cur = { ignite: 0, section: 0, explode: 0 };
  let shift = opts.shiftX || 0, shiftY = opts.shiftY || 0, running = false, last = performance.now(), igniteT = 0;
  const mouse = { x: 0, y: 0 }; addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; }, { passive: true });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h;
    const sx = typeof shift === 'function' ? shift(w) : shift, sy = typeof shiftY === 'function' ? shiftY(w) : shiftY;
    if (sx || sy) camera.setViewOffset(w, h, -w * sx, h * sy, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();

  const tmp = new THREE.Vector3(), camDir = new THREE.Vector3();
  function frame(now) {
    if (!running) return; requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; U.uTime.value += dt;
    const k = 1 - Math.exp(-dt * 3.4);
    for (const key of ['ignite', 'section', 'explode']) cur[key] += (state[key] - cur[key]) * (key === 'ignite' ? 1 - Math.exp(-dt * 5) : k);
    const ig = cur.ignite * (0.94 + 0.06 * Math.sin(U.uTime.value * 31) * Math.sin(U.uTime.value * 7.3));
    U.uIgnite.value = ig; U.uSec.value = cur.section;
    fire.intensity = 22 * ig; bloom.strength = 0.22 + 0.55 * cur.ignite;
    // explode
    for (const p of Object.values(parts)) p.obj.position.copy(p.base).addScaledVector(p.ex, cur.explode);
    plume.visible = inner.visible = exhaust.visible = cur.ignite > 0.01; disks.forEach(d => d.visible = plume.visible);
    plume.position.y = inner.position.y = EXIT_Y + parts.nozzle.obj.position.y; disks.forEach((d, i) => { d.position.y = plume.position.y - (1.0 + i * 1.02) + Math.sin(U.uTime.value * 30 + i) * 0.03; });
    // camera-facing cut
    camera.getWorldPosition(tmp); camDir.set(tmp.x, 0, tmp.z).normalize();
    cut.normal.set(-camDir.x, 0, -camDir.z); cut.constant = cur.section < 0.02 ? 50 : THREE.MathUtils.lerp(2.5, -0.001, Math.min(1, cur.section * 1.25));
    // exhaust
    if (cur.ignite > 0.01) {
      for (let i = 0; i < NP; i++) { pLife[i] += dt * (0.9 + Math.random() * 0.4);
        if (pLife[i] > 1) respawn(i), pLife[i] = 0;
        pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        const l = pLife[i]; pCol[i * 3] = 1; pCol[i * 3 + 1] = 0.55 - l * 0.4; pCol[i * 3 + 2] = 0.2 - l * 0.18; }
      pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true; exhaust.position.y = parts.nozzle.obj.position.y;
    }
    pMat.opacity = 0.16 * cur.ignite;
    // internal flow
    fMat.opacity = Math.min(1, cur.section * 1.3) * 0.95;
    if (cur.section > 0.01) {
      for (let i = 0; i < NF; i++) { const s = fS[i]; const r = radius(s); const v = s < S_THROAT ? 0.12 + 0.88 * Math.pow(0.22 / r, 2) : 1 + 1.3 * (1 - Math.pow(0.22 / r, 0.8)); // ~Mach number
        fS[i] += (0.35 + v) * dt * 0.7; if (fS[i] > SMAX) { fS[i] = 0.05; fR[i] = (Math.random() * 2 - 1) * 0.92; }
        const rr = fR[i] * radius(fS[i]); const ex = fS[i] > 2.0 ? parts.nozzle.obj.position.y : 0;
        fPos[i * 3] = rr * camDir.z; fPos[i * 3 + 1] = yOf(fS[i]) + ex; fPos[i * 3 + 2] = -rr * camDir.x; // lies in the cut plane
        fPos[i * 3] -= camDir.x * 0.02; fPos[i * 3 + 2] -= camDir.z * 0.02;
        const c = jet(Math.min(1, v / 2.1)); fCol[i * 3] = c[0]; fCol[i * 3 + 1] = c[1]; fCol[i * 3 + 2] = c[2]; }
      fGeo.attributes.position.needsUpdate = fGeo.attributes.color.needsUpdate = true;
    }
    // camera
    if (opts.onFrame) opts.onFrame(camera, target, mouse, dt);
    if (controls) controls.update(); else camera.lookAt(target);
    composer.render();
    // labels
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const L of labels) {
      const show = L.el.dataset.group === state.labels && cur.ignite < 0.3;
      L.parent.localToWorld(tmp.copy(L.local)); tmp.project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
      L.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      const flip = x > w - 300; if (flip !== L.f) { L.f = flip; L.el.classList.toggle('flip', flip); }
      const v = show && tmp.z < 1 && w >= 1000 && x > 40 && x < w - 40 && y > 90 && y < h - 120; if (v !== L.v) { L.v = v; L.el.classList.toggle('on', v); }
    }
  }
  return {
    set(s) { Object.assign(state, s); if (s.ignite === 1) igniteT = performance.now(); },
    get state() { return state; }, camera, target, controls,
    reset() { Object.assign(state, { ignite: 0, section: 0, explode: 0, labels: 'cad' }); Object.assign(cur, { ignite: 0, section: 0, explode: 0 }); },
    setShift(v) { shift = v; resize(); },
    start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } },
    stop() { running = false; },
  };
}
