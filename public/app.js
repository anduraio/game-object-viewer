/* game-object-viewer — front end.
 * One shared scene, five viewports: a large isometric diagonal (front-left)
 * on the right, fixed orthographic FRONT / REAR / SIDE / TOP on the left.
 * The model list comes from GET /api/models; models load either from files
 * (glb/gltf/obj/stl/ply/fbx) or from *.model.js procedural builders.
 *
 * The viewer itself runs on the same vendored three ESM build the import map
 * hands to the games' own modules — one three everywhere, so a builder's
 * objects and the renderer always agree. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// dynamic-import bridge for .model.js builders: resolves through this page's
// import map, so a game module importing bare 'three' or 'three/addons/...'
// gets the same vendored build.
const govImport = (u) => import(new URL(u, location.href).href);

(function () {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------------------------------------------- scene (shared) ------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e131c);
  scene.fog = new THREE.Fog(0x0e131c, 14, 30);

  scene.add(new THREE.HemisphereLight(0x9db2d6, 0x1a1f2b, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(4, 12, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5; key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;   key.shadow.camera.bottom = -5;
  key.shadow.camera.far = 30;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5f7cff, 1.4);
  rim.position.set(-6, 4, -5);
  scene.add(rim);

  // the model lands in here; everything else in the scene is dressing
  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 48),
    new THREE.MeshStandardMaterial({ color: 0x141a26, metalness: .2, roughness: .9 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.receiveShadow = true;
  scene.add(disc);
  const grid = new THREE.GridHelper(14, 28, 0x2e3a50, 0x1c2434);
  grid.material.transparent = true;
  grid.material.opacity = .55;
  grid.position.y = .001;
  scene.add(grid);

  /* ---------------------------------------------------- viewports ------ */
  const TARGET = new THREE.Vector3(0, 1.3, 0);

  function makeRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    return r;
  }

  const views = [];
  function addView(canvasId, camera) {
    const canvas = document.getElementById(canvasId);
    const v = { canvas, renderer: makeRenderer(canvas), camera };
    views.push(v);
    const resize = () => {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      v.renderer.setSize(w, h, false);
      if (camera.isPerspectiveCamera) camera.aspect = w / h;
      else {
        const halfH = camera.userData.halfH;
        camera.left = -halfH * w / h; camera.right = halfH * w / h;
        camera.top = halfH; camera.bottom = -halfH;
      }
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas.parentElement);
    resize();
    return v;
  }

  const HALF_H = 2.45;
  function ortho(pos, up) {
    const c = new THREE.OrthographicCamera(-1, 1, HALF_H, -HALF_H, .1, 80);
    c.position.copy(pos);
    if (up) c.up.copy(up);
    c.lookAt(TARGET);
    c.userData.halfH = HALF_H;
    c.zoom = 1;
    return c;
  }
  // fixed views sit well inside the scene fog's near plane (14) so the
  // ortho panes stay crisp while the iso pane keeps its depth cue
  addView('c-front', ortho(new THREE.Vector3(0, 1.3, 10)));
  addView('c-rear',  ortho(new THREE.Vector3(0, 1.3, -10)));
  addView('c-side',  ortho(new THREE.Vector3(10, 1.3, 0)));
  addView('c-top',   ortho(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 0, -1)));

  for (const v of views) {
    v.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      v.camera.zoom = clamp(v.camera.zoom * (e.deltaY < 0 ? 1.1 : .9), .5, 4);
      v.camera.updateProjectionMatrix();
    }, { passive: false });
  }

  // isometric diagonal from the front-left — the pinned "reset view" pose
  const iso = addView('c-iso', new THREE.PerspectiveCamera(40, 1, .1, 120));
  const DEFAULT = { yaw: -Math.PI / 4, pitch: .52, dist: 7.5 };
  const isoState = { ...DEFAULT };
  function applyIso() {
    const { yaw, pitch, dist } = isoState;
    iso.camera.position.set(
      TARGET.x + dist * Math.cos(pitch) * Math.sin(yaw),
      TARGET.y + dist * Math.sin(pitch),
      TARGET.z + dist * Math.cos(pitch) * Math.cos(yaw)
    );
    iso.camera.lookAt(TARGET);
  }
  const isoCard = document.getElementById('isoCard');
  let dragging = false, lastX = 0, lastY = 0;
  isoCard.addEventListener('pointerdown', e => {
    if (e.target.closest('.tag')) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    isoCard.classList.add('dragging');
    isoCard.setPointerCapture(e.pointerId);
  });
  isoCard.addEventListener('pointermove', e => {
    if (!dragging) return;
    isoState.yaw -= (e.clientX - lastX) * .006;
    isoState.pitch = clamp(isoState.pitch + (e.clientY - lastY) * .006, .05, 1.45);
    lastX = e.clientX; lastY = e.clientY;
  });
  const endDrag = () => { dragging = false; isoCard.classList.remove('dragging'); };
  isoCard.addEventListener('pointerup', endDrag);
  isoCard.addEventListener('pointercancel', endDrag);
  iso.canvas.addEventListener('wheel', e => {
    e.preventDefault();
    isoState.dist = clamp(isoState.dist * (1 + e.deltaY * .001), 3, 18);
  }, { passive: false });
  document.getElementById('resetIso').addEventListener('click', () => Object.assign(isoState, DEFAULT));
  const autoRot = document.getElementById('autoRot');

  function frame() {
    requestAnimationFrame(frame); // scheduled first: a throwing render must not kill the loop
    if (autoRot.checked && !dragging) isoState.yaw += .004;
    applyIso();
    for (const v of views) {
      try { v.renderer.render(scene, v.camera); }
      catch (e) { console.error('render failed:', e); }
    }
  }
  frame();

  /* ------------------------------------------------------- library ----- */
  const libEl = document.getElementById('lib');
  const srcsEl = document.getElementById('srcs');
  const searchEl = document.getElementById('search');
  const infoName = document.getElementById('infoName');
  const infoMeta = document.getElementById('infoMeta');
  const infoPath = document.getElementById('infoPath');
  const loadingEl = document.getElementById('loading');
  const GLYPH = { glb: '▦', gltf: '▦', obj: '◇', stl: '△', ply: '◈', fbx: '▣', proc: '◆' };

  let entries = [];      // viewable models, flat, in sidebar order
  let sources = [];
  let selectedId = null;
  let loadToken = 0;

  const fileUrl = e => '/file/' + e.path;

  async function fetchLibrary() {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('/api/models failed: ' + res.status);
    const lib = await res.json();
    entries = lib.models;
    sources = lib.sources;
    renderLib();
    renderSources();
  }

  function renderLib() {
    const q = searchEl.value.trim().toLowerCase();
    libEl.textContent = '';
    const visible = entries.filter(e =>
      !q || e.name.toLowerCase().includes(q) || e.game.toLowerCase().includes(q) || e.id.includes(q));
    const byGame = new Map();
    for (const e of visible) {
      if (!byGame.has(e.game)) byGame.set(e.game, []);
      byGame.get(e.game).push(e);
    }
    if (!visible.length) {
      const d = document.createElement('div');
      d.className = 'libempty';
      d.textContent = q ? 'nothing matches “' + q + '”.' :
        'no models found. add model files (glb, gltf, obj, stl, ply, fbx) or *.model.js builders under a configured root, then rescan.';
      libEl.appendChild(d);
    }
    for (const [game, list] of byGame) {
      const h = document.createElement('div');
      h.className = 'gamehdr';
      h.textContent = game + ' · ' + list.length;
      libEl.appendChild(h);
      for (const e of list) {
        const it = document.createElement('div');
        it.className = 'item' + (e.id === selectedId ? ' sel' : '');
        it.dataset.id = e.id;
        const g = document.createElement('span'); g.className = 'glyph'; g.textContent = GLYPH[e.format] || '▪';
        const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = e.name; nm.title = e.name;
        const fm = document.createElement('span'); fm.className = 'fm'; fm.textContent = e.format;
        it.append(g, nm, fm);
        it.addEventListener('click', () => select(e.id));
        libEl.appendChild(it);
      }
    }
  }

  function renderSources() {
    srcsEl.textContent = '';
    if (!sources.length) {
      const d = document.createElement('div');
      d.className = 'libempty';
      d.textContent = 'none found under the configured roots.';
      srcsEl.appendChild(d);
      return;
    }
    for (const s of sources) {
      const d = document.createElement('div');
      d.className = 'src';
      const p = document.createElement('div'); p.className = 'p'; p.textContent = s.path;
      const h = document.createElement('div'); h.className = 'h';
      const bits = [];
      if (s.builders.length) bits.push('builders: ' + s.builders.slice(0, 3).join(', ') + (s.builders.length > 3 ? '…' : ''));
      if (s.geometries.length) bits.push(s.geometries.length + ' geometry kind(s)');
      h.innerHTML = bits.length ? bits.map(b => '<b>' + b + '</b>').join(' · ') : 'three.js detected';
      d.append(p, h);
      d.title = 'ask the agent to extract this into a *.model.js to make it viewable';
      srcsEl.appendChild(d);
    }
  }

  /* ------------------------------------------------------- loading ----- */
  function disposeObject(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap']) {
          if (m[k] && m[k].dispose) m[k].dispose();
        }
        m.dispose();
      }
    });
  }

  function setInfo(name, meta, p, isError) {
    infoName.textContent = name;
    infoMeta.textContent = meta || '';
    infoPath.textContent = p || '';
    infoMeta.className = isError ? 'err' : '';
    infoName.className = isError ? 'err' : 'nm';
  }

  function statsOf(obj) {
    let tris = 0;
    const box = new THREE.Box3().setFromObject(obj);
    obj.traverse(o => {
      if (o.isMesh && o.geometry) {
        const g = o.geometry;
        tris += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
      }
    });
    const size = box.getSize(new THREE.Vector3());
    return {
      tris: Math.round(tris),
      dims: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`,
    };
  }

  // fit: longest edge → 3 units, feet on the ground, centred on the pedestal
  function normalize(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 3 / maxDim;
    const inner = new THREE.Group();
    inner.add(obj);
    inner.scale.setScalar(s);
    const nb = new THREE.Box3().setFromObject(inner);
    const c = nb.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -nb.min.y, -c.z);
    const wrap = new THREE.Group();
    wrap.add(inner);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return wrap;
  }

  function loadFile(entry) {
    const url = fileUrl(entry);
    const dir = url.slice(0, url.lastIndexOf('/') + 1);
    const fmt = entry.format;
    return new Promise((resolve, reject) => {
      const fail = (label) => (e) => reject(new Error(label + ': ' + ((e && e.message) || e)));
      if (fmt === 'glb' || fmt === 'gltf') {
        const loader = new GLTFLoader();
        loader.setResourcePath(dir);
        loader.load(url, g => resolve(g.scene), undefined, fail('gltf parse'));
      } else if (fmt === 'obj') {
        new OBJLoader().load(url, o => resolve(o), undefined, fail('obj parse'));
      } else if (fmt === 'fbx') {
        new FBXLoader().load(url, o => resolve(o), undefined, fail('fbx parse'));
      } else if (fmt === 'stl' || fmt === 'ply') {
        const L = fmt === 'stl' ? new STLLoader() : new PLYLoader();
        L.load(url, geo => {
          if (!geo.attributes.normal) geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            color: 0x9aa6b8, metalness: .5, roughness: .45,
          }));
          resolve(mesh);
        }, undefined, fail(fmt + ' parse'));
      } else {
        reject(new Error('no loader for .' + fmt));
      }
    });
  }

  async function loadProc(entry) {
    const res = await fetch(fileUrl(entry));
    if (!res.ok) throw new Error('fetch failed: ' + res.status);
    const code = await res.text();
    const regs = [];
    const registerGovModel = (name, builder) => regs.push({ name, builder });
    // the sandbox is a plain function scope: a model file may only register
    // builders and use what it is handed (THREE, imports). no globals leak in.
    new Function('registerGovModel', '"use strict";\n' + code)(registerGovModel);
    if (!regs.length) throw new Error('no registerGovModel() call in ' + entry.path);
    // entries map 1:1 to registrations when the scanner could read them;
    // otherwise every builder in the file is built and laid out side by side
    const targets = entry.regIndex != null && regs[entry.regIndex] ? [regs[entry.regIndex]] : regs;
    const group = new THREE.Group();
    const names = [];
    let cursorX = 0;
    for (const r of targets) {
      const obj = await r.builder({ THREE, imports: govImport });
      if (!obj || !obj.isObject3D) throw new Error(`builder "${r.name}" did not return a THREE.Object3D`);
      obj.userData.govName = r.name;
      obj.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(obj);
      obj.position.x += cursorX - box.min.x;
      cursorX += (box.max.x - box.min.x) + .6;
      group.add(obj);
      names.push(r.name);
    }
    group.userData.govNames = names;
    return group;
  }

  async function select(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    selectedId = id;
    renderLib();
    const token = ++loadToken;
    loadingEl.classList.add('on');
    setInfo(entry.name, 'loading…', entry.path);
    try {
      const obj = entry.type === 'proc' ? await loadProc(entry) : await loadFile(entry);
      if (token !== loadToken) { disposeObject(obj); return; }
      const fitted = normalize(obj);
      const st = statsOf(fitted);
      const old = modelRoot.children[0];
      if (old) { modelRoot.remove(old); disposeObject(old); }
      modelRoot.add(fitted);
      const dims = `${st.dims} units`;
      const meta = `${entry.game} · ${entry.format} · ${dims} · ${st.tris.toLocaleString()} tris`;
      setInfo(entry.name, meta, entry.path);
      const u = new URL(location.href);
      u.searchParams.set('model', entry.id);
      history.replaceState(null, '', u);
      Object.assign(isoState, DEFAULT); // a new model starts at the pinned pose
    } catch (e) {
      if (token === loadToken) setInfo(entry.name, 'failed to load — ' + e.message, entry.path, true);
    } finally {
      if (token === loadToken) loadingEl.classList.remove('on');
    }
  }

  function step(delta) {
    if (!entries.length) return;
    const i = entries.findIndex(e => e.id === selectedId);
    const next = entries[clamp((i < 0 ? 0 : i + delta), 0, entries.length - 1)];
    if (next) select(next.id);
  }

  document.getElementById('prevBtn').addEventListener('click', () => step(-1));
  document.getElementById('nextBtn').addEventListener('click', () => step(1));
  searchEl.addEventListener('input', renderLib);
  document.addEventListener('keydown', e => {
    if (e.target === searchEl || /input|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key.toLowerCase() === 'r') Object.assign(isoState, DEFAULT);
    else if (e.code === 'Space') { e.preventDefault(); autoRot.checked = !autoRot.checked; }
  });

  /* --------------------------------------------------------- boot ------ */
  // escape hatch for agents and debugging: the shared scene and viewports
  window.__gov = { scene, modelRoot, views, select };

  (async () => {
    try {
      await fetchLibrary();
      const want = new URL(location.href).searchParams.get('model');
      const first = entries.find(e => e.id === want) || entries[0];
      if (first) select(first.id);
      else setInfo('no models yet', 'add files or *.model.js builders under a root, then run: node gov.js scan', '', false);
    } catch (e) {
      setInfo('could not reach the API', String(e.message || e), 'is the server running? node gov.js serve', true);
    }
  })();
})();
