# game-object-viewer

Scan a workspace's games for 3D models, put them in one list, and inspect them
one by one — from the angles that matter for modelling: a large isometric
diagonal, plus fixed orthographic **front / rear / side / top**.

Zero dependencies. Sibling tool to `game-inspector`: that one flies a running
game's live scene; this one collects every model the games have and gives each
one the same five views, so you can judge shape, silhouette and proportions
without launching the game.

```bash
node gov.js scan        # walk the configured roots, print what was found
node gov.js list --json # the library, machine-readable
node gov.js serve       # the viewer + API on http://localhost:8799/
node gov.js open        # print (and launch) the viewer URL
```

Then open <http://localhost:8799/>. Pick a model in the left library; the five
views follow. `←`/`→` step through the library, `R` resets the view, `space`
toggles the slow turntable. Drag orbits the iso view; wheel zooms every pane.

## What counts as a model

**Model files** — `.glb .gltf .obj .stl .ply .fbx`, loaded with the real
loaders (`.gltf` resolves external `.bin`/textures against its own URL).

**Procedural models** — `*.model.js`. Both current games build their 3D in
code, so this is the bridge that makes code-built models viewable. A model
file registers builders; each builder returns a `THREE.Object3D`:

```js
registerGovModel('Void Raider Player Ship', ({ THREE }) => {
  const g = new THREE.Group();
  // ... geometry, materials ...
  return g;   // feet at y=0, facing +Z — the viewer's "front"
});
```

The viewer fits each model to the pedestal automatically (longest edge → 3
units, feet on the ground), so builders don't have to match scales. A file may
register several models; they are laid out side by side. Builders may be
`async` and may pull in the game's own modules through `imports(...)`.

**three.js sources** — `.js`/`.html` that constructs geometry but isn't
viewable yet. The scan lists them with the builder and geometry names found
inside, as extraction targets: the intended loop is "ask the agent to extract
`createCharacter` from `scene.js` into a `.model.js`", and it becomes a
viewable model. Files using a raw WebGL engine (no `THREE.`) are not listed —
there is nothing honest to show; re-create the mesh in three.js instead.

## Extracting from a real game, without drift

Prefer importing the game's actual builder over copying it, so the view stays
true when the game changes. See `GAME/pocket-sports/gov-models/character.model.js`:

```js
registerGovModel('Pocket Sports Character (red)', async ({ imports }) => {
  const mod = await imports('/file/GAME/pocket-sports/public/js/tv/scene.js');
  const rig = mod.createCharacter({ color: '#ff4554', name: 'P1' });
  rig.group.rotation.y = Math.PI;   // game characters face -Z; viewer front is +Z
  return rig.group;
});
```

`/file/<workspace-relative-path>` serves any file under a configured root, so
the game's ES modules load unmodified — its bare `import 'three'` resolves
through the page's import map to the vendored `three.module.js`. Game-facing
dressing that is not model (name sprites, HUD labels) is removed before
showing; presentation-only turns like facing the camera are done in the
`.model.js`, not in the game.

Copied-code extractions are fine when the game's builder is entangled with
physics or engine state — accept that they can drift from the game and say so
in the file header.

## Talking to the agent

`SKILL.md` ships with the repo: copy it into your coding agent's skills
directory (for ZCode, `~/.agents/skills/game-object-viewer/SKILL.md`) and the
agent knows the whole loop — start the server, scan, list, open a deep link
(`http://localhost:8799/?model=<id>`), screenshot the five views, and write
`.model.js` extractors when a model only exists as game code. The same surface
is plain HTTP, so any client works:

- `GET /api/models` — `{ models, sources }`, fresh scan every call
- `GET /file/<path>` — model files and game sources, guarded to the roots
- `GET /?model=<id>` — deep link to one model

## Configuration — `gov.config.json`

```json
{
  "port": 8799,
  "workspace": "..",
  "roots": ["GAME", { "path": "game-object-viewer/models", "label": "built-in" }]
}
```

`workspace` is the base for `/file/` paths (default: the tool's parent
directory). Each root is a directory to walk; a root holding several projects
(one directory per game) groups its models by that first directory, otherwise
by its `label` or folder name. `node_modules`, `.git`, dotfolders and build
output are skipped. Add a root when a new game lands; rescan happens on every
`/api/models` call, so new model files appear on refresh.

## What it is not

- **Not a test harness.** No verdicts, no assertions — it is for looking,
  like game-inspector. The `← →` loop and the five fixed views exist so a
  human (or an agent relaying screenshots) can judge a model, not to gate a
  build.
- **Not a screenshot differ.** Capture from a fixed pose if you want visual
  regression tests.
- **Not a runtime inspector.** It never attaches to a running game; that is
  game-inspector's job, and the two compose: fly the live scene there to find
  what to extract, view it here against the grid.
- **No physics, no animation.** A model is shown as a static object at its
  bind pose; rigs, skinned animations and game-time behaviour are out of
  scope.

## Honest limitations

- A `.gltf` with external buffers/textures must live under a configured root
  along with its resources, or the fetches 403.
- `FBX` support rides on the vendored `fflate`; binary FBX with embedded
  textures usually renders, exotic vertex formats may not.
- Procedural extractions that import game modules execute game code in the
  viewer page. Only point roots at code you trust — same bargain as opening
  the game in a browser.
- The scanner's "three.js source" detection is a grep, not a parser: a source
  using geometry through wrappers it can't see will be missed.
- The sandbox gives builders `THREE`, `imports` and nothing else — no DOM,
  no access to the viewer's scene. A builder that needs more is a builder
  doing too much.
- Ortho panes use one shared frustum height, so very wide models clip at the
  pane edges; wheel-zoom out (the frustum is per-pane) or look at the iso view.

## Vendored code

`vendor/` bundles MIT-licensed builds of three.js (r128 global for the
viewer's renderer, r170 ESM as the import-map target the games' own modules
resolve against), the three.js example loaders, and fflate (needed by the FBX
loader) — see `vendor/README.md` and the license texts in
`vendor/licenses/`. They are vendored, not depended on, so the tool stays
zero-install; point the script tags and import map in `public/index.html`
elsewhere if you would rather serve your own.

## License

MIT — see [LICENSE](LICENSE).
