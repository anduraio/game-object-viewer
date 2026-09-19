#!/usr/bin/env node
/**
 * game-object-viewer — scan a workspace's games for 3D models, list them,
 * and inspect each one in a multi-view (iso + front/rear/side/top) web viewer.
 *
 * Zero dependencies. Sibling tool to game-inspector: that one flies a running
 * game's live scene; this one puts every model the games ship — model files,
 * procedural builders, and models extracted for viewing — in one list, viewed
 * one by one, from the angles that matter for modelling.
 *
 *   game-object-viewer scan              walk the configured roots, print what was found
 *   game-object-viewer list [--json]     the library (from a fresh scan)
 *   game-object-viewer serve [--port N]  the viewer + API (default port from config)
 *   game-object-viewer open [id]         print (and launch) the viewer at one model
 *
 * What counts as a model:
 *   - model files            .glb .gltf .obj .stl .ply .fbx
 *   - procedural models      *.model.js  (registerGovModel('Name', builder))
 *   - three.js sources       .js/.html that builds geometry — listed with the
 *                            geometry and builder names found inside, as
 *                            extraction targets, not as viewable models
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const TOOL_DIR = import.meta.dirname;
const CONFIG_PATH = path.join(TOOL_DIR, 'gov.config.json');
const CACHE_PATH = path.join(TOOL_DIR, '.gov', 'library.json');

const MODEL_EXTS = new Set(['.glb', '.gltf', '.obj', '.stl', '.ply', '.fbx']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.gov', 'dist', 'build', 'certs', '.zcode']);
const SOURCE_EXT = new Set(['.js', '.mjs', '.html']);
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

/* ------------------------------------------------------------- config ---- */

function loadConfig() {
  const defaults = {
    port: 8799,
    workspace: '..',
    roots: ['GAME', { path: 'game-object-viewer/models', label: 'built-in' }],
  };
  let cfg = defaults;
  try { cfg = { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) }; }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const workspace = path.resolve(TOOL_DIR, cfg.workspace);
  const roots = cfg.roots
    .map(r => (typeof r === 'string' ? { path: r } : r))
    .map(r => ({ ...r, abs: path.resolve(workspace, r.path) }))
    .filter(r => { try { return fs.statSync(r.abs).isDirectory(); } catch { return false; } });
  return { ...cfg, workspace, roots };
}

/* --------------------------------------------------------------- scan ---- */

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function detectSource(text) {
  const geometries = [...new Set([...text.matchAll(/new\s+THREE\.(\w+Geometry)/g)].map(m => m[1]))];
  const builders = [...new Set([...text.matchAll(/\b(?:function|const)\s+((?:create|make|build)[A-Za-z0-9_]*)/g)].map(m => m[1]))];
  const threeImport = /\bfrom\s+['"]three['"]|\bTHREE\./.test(text);
  if (!threeImport) return null;
  return { geometries, builders };
}

function scanRoots(cfg) {
  const models = [];
  const sources = [];
  const seen = new Set();

  // grouping rule: a root that holds several projects (each in its own
  // directory) groups by that first directory; otherwise the root's label.
  const gameLabel = (root, relUnder) => {
    const first = relUnder.split('/')[0];
    if (relUnder.includes('/') && first) {
      try {
        if (fs.statSync(path.join(root.abs, first)).isDirectory()) return first;
      } catch { /* fall through */ }
    }
    return root.label || path.basename(root.abs);
  };

  const walk = (root, dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      if (ent.name.startsWith('.') || SKIP_DIRS.has(ent.name)) continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(root, abs); continue; }
      const rel = path.relative(cfg.workspace, abs).split(path.sep).join('/');
      if (seen.has(rel)) continue;
      seen.add(rel);
      const ext = path.extname(ent.name).toLowerCase();
      const game = gameLabel(root, path.relative(root.abs, abs).split(path.sep).join('/'));
      let st; try { st = fs.statSync(abs); } catch { continue; }

      if (MODEL_EXTS.has(ext)) {
        models.push({
          id: slug(rel.replace(/\.[^.]+$/, '')),
          type: 'file', format: ext.slice(1),
          name: path.basename(ent.name, ext).replace(/[-_]+/g, ' '),
          game, path: rel, bytes: st.size, mtime: st.mtimeMs,
        });
      } else if (ent.name.endsWith('.model.js')) {
        let names = [];
        try {
          const text = fs.readFileSync(abs, 'utf8');
          names = [...text.matchAll(/registerGovModel\(\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1]);
        } catch { /* unreadable: still listed, named after the file */ }
        const base = path.basename(ent.name, '.model.js').replace(/[-_]+/g, ' ');
        models.push({
          id: slug(rel.replace(/\.model\.js$/, '')),
          type: 'proc', format: 'proc',
          name: names[0] || base,
          allNames: names,
          game, path: rel, bytes: st.size, mtime: st.mtimeMs,
        });
      } else if (SOURCE_EXT.has(ext) && st.size <= MAX_SOURCE_BYTES) {
        let text; try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
        const hit = detectSource(text);
        if (hit && (hit.geometries.length || hit.builders.length)) {
          sources.push({ game, path: rel, bytes: st.size, ...hit });
        }
      }
    }
  };

  for (const root of cfg.roots) walk(root, root.abs);
  return { models, sources, scannedAt: new Date().toISOString() };
}

function scanOrCached(cfg, force = true) {
  if (!force) {
    try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch { /* fall through */ }
  }
  const lib = scanRoots(cfg);
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(lib, null, 2));
  } catch { /* cache is best-effort */ }
  return lib;
}

function printScan(lib) {
  const byGame = new Map();
  for (const m of lib.models) {
    if (!byGame.has(m.game)) byGame.set(m.game, []);
    byGame.get(m.game).push(m);
  }
  console.log(`scanned ${lib.models.length} model(s), ${lib.sources.length} three.js source(s)\n`);
  for (const [game, ms] of byGame) {
    console.log(`  ${game}/`);
    for (const m of ms) {
      const size = m.bytes > 1048576 ? (m.bytes / 1048576).toFixed(1) + ' MB'
        : m.bytes > 1024 ? Math.round(m.bytes / 1024) + ' KB' : m.bytes + ' B';
      console.log(`    ${(m.type === 'proc' ? 'proc' : m.format).padEnd(5)} ${m.name}  (${m.id})  ${size}`);
    }
  }
  if (lib.sources.length) {
    console.log('\n  three.js sources (extraction targets — not directly viewable):');
    for (const s of lib.sources) {
      const parts = [];
      if (s.builders.length) parts.push(`builders: ${s.builders.slice(0, 4).join(', ')}${s.builders.length > 4 ? '…' : ''}`);
      if (s.geometries.length) parts.push(`geometry: ${s.geometries.length} kind(s)`);
      console.log(`    ${s.path}\n      ${parts.join(' · ') || 'three.js detected'}`);
    }
    console.log('\n  tip: ask the agent to extract a source into <name>.model.js so it becomes viewable.');
  }
}

/* -------------------------------------------------------------- serve ---- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2',
  '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.obj': 'text/plain; charset=utf-8',
  '.stl': 'model/stl', '.ply': 'application/octet-stream', '.fbx': 'application/octet-stream',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function serve(cfg) {
  const pub = path.join(TOOL_DIR, 'public');

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'content-type': type });
      res.end(body);
    };
    const sendFile = (abs) => {
      const type = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
      fs.readFile(abs, (err, buf) => {
        if (err) send(404, JSON.stringify({ error: 'not found' }));
        else { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' }); res.end(buf); }
      });
    };

    try {
      if (p === '/' || p === '/index.html') return sendFile(path.join(pub, 'index.html'));
      if (p === '/app.js') return sendFile(path.join(pub, 'app.js'));
      if (p.startsWith('/vendor/')) {
        const abs = path.normalize(path.join(pub, p));
        if (!abs.startsWith(pub + path.sep)) return send(403, JSON.stringify({ error: 'forbidden' }));
        return sendFile(abs);
      }
      if (p === '/api/models') {
        const lib = scanRoots(cfg);
        return send(200, JSON.stringify(lib));
      }
      if (p.startsWith('/file/')) {
        const rel = decodeURIComponent(p.slice('/file/'.length));
        const abs = path.resolve(cfg.workspace, rel);
        const allowed = cfg.roots.some(root => abs === root.abs || abs.startsWith(root.abs + path.sep));
        if (!allowed) return send(403, JSON.stringify({ error: 'path is outside the configured roots' }));
        return sendFile(abs);
      }
      return send(404, JSON.stringify({ error: 'not found' }));
    } catch (e) {
      return send(500, JSON.stringify({ error: String((e && e.message) || e) }));
    }
  });

  server.on('error', e => {
    console.error(`serve failed: ${e.message}`);
    process.exit(1);
  });
  server.listen(cfg.port, () => {
    console.log('game-object-viewer');
    console.log(`  viewer   http://localhost:${cfg.port}/`);
    console.log(`  api      http://localhost:${cfg.port}/api/models`);
    console.log(`  roots    ${cfg.roots.map(r => (r.label ? `${r.abs} (${r.label})` : r.abs)).join(', ')}`);
    console.log('  ctrl-c to stop');
  });
}

/* ---------------------------------------------------------------- cli ---- */

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv.find(a => !a.startsWith('--')) || 'serve';
  const flag = name => argv.includes(`--${name}`);
  const numFlag = (name, dflt) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? Number(argv[i + 1]) : dflt;
  };

  const USAGE = `game-object-viewer — scan games for 3D models, view them one by one

  game-object-viewer scan               walk the configured roots, print what was found
  game-object-viewer list [--json]      the library (from a fresh scan)
  game-object-viewer serve [--port N]   the viewer + API (default: gov.config.json port)
  game-object-viewer open [id]          print (and launch) the viewer at one model

configure roots and port in gov.config.json next to this file; see README.md.`;

  if (flag('help') || cmd === 'help') {
    console.log(USAGE);
    return;
  }

  const cfg = loadConfig();

  if (cmd === 'scan') {
    printScan(scanOrCached(cfg));
  } else if (cmd === 'list') {
    const lib = scanOrCached(cfg);
    if (flag('json')) console.log(JSON.stringify(lib, null, 2));
    else printScan(lib);
  } else if (cmd === 'open') {
    const id = argv[argv.indexOf('open') + 1];
    const url = `http://localhost:${cfg.port}/${id ? `?model=${id}` : ''}`;
    console.log(url);
    if (!flag('no-launch') && process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    }
  } else if (cmd === 'serve') {
    cfg.port = numFlag('port', cfg.port);
    serve(cfg);
  } else {
    console.error(`unknown command: ${cmd} — try scan | list | serve | open`);
    process.exit(2);
  }
}

main();
