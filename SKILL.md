---
name: game-object-viewer
description: Scan a workspace's games for 3D models and inspect them one by one in a multi-view (iso + front/rear/side/top) web viewer. Use when the user asks to view, scan, list, inspect, or polish game 3D models or objects, or during game development to check how a model looks from all sides.
---

# game-object-viewer

Tool location: `code/game-object-viewer` (relative to the workspace root). Zero-dependency Node CLI + local web viewer. Full docs in its README.md.

## When to use

- The user asks to see, scan, list, or inspect the 3D models/objects in their games.
- The user (or you, as their agent) just created a 3D model — as a file or as game code — and it should be checked from all sides before it ships.
- A user is polishing a model and wants the iso + orthographic views side by side.

## The loop

1. **Server**: check if it's up: `curl -s http://localhost:8799/api/models`. If not, start it in the background from the tool folder:

   ```bash
   cd code/game-object-viewer && node gov.js serve
   ```

2. **Scan / list**: `node gov.js scan` prints models grouped per game plus "three.js sources" (extraction targets). `node gov.js list --json` returns `{ models, sources }`. The same JSON is at `GET /api/models`, rescanned on every call — new model files appear on page refresh without restarting.

3. **Open a model for the user**: give them the deep link `http://localhost:8799/?model=<id>` (ids are in the scan output), or `node gov.js open <id>`. To inspect it yourself, open the URL in the in-app browser (browser-use skill) and screenshot. The five panes are the deliverable: iso (drag to orbit), FRONT, REAR, SIDE, TOP (fixed orthographic, wheel to zoom).

4. **Extract models that only exist as game code.** If the scan lists a source under "three.js sources" and the user wants it viewable, write `GAME/<game>/gov-models/<name>.model.js`:

   ```js
   registerGovModel('Model Name', async ({ THREE, imports }) => {
     const mod = await imports('/file/<path-relative-to-workspace>');
     const obj = mod.createSomething(/* args the game itself passes */);
     obj.rotation.y = Math.PI;          // game faces -Z → viewer front is +Z, if needed
     obj.remove(obj.getObjectByName('…label')); // strip HUD dressing, keep the model
     return obj;                         // feet at y=0, facing +Z; scale is auto-fitted
   });
   ```

   Prefer importing the game's real builder (stays true when the game changes) over copying code. Copy only when the builder is entangled with physics/engine state, and note the drift risk in a header comment. Sync builders get `({ THREE })`; async ones may `await imports(url)`. Each registration is its own library entry, so group a model family in one file.

5. **Report**: after creating or fixing a model, open its deep link, screenshot, and say what the five views show (silhouette from TOP, proportions from FRONT/SIDE) — that is the polishing feedback the tool exists for.

## Rules

- Model files it loads: `.glb .gltf .obj .stl .ply .fbx`; procedural: `*.model.js` anywhere under a configured root (`gov.config.json`: GAME + built-ins + examples by default). Add roots there for new games.
- Never rewrite the user's game code to make it viewable — add a `*.model.js` beside it instead.
- The viewer auto-fits scale; don't scale game builders to look right in the viewer.
- This is an inspection tool, not a test: never wire it into CI or treat screenshots as a pass/fail gate.
- If `/api/models` returns fewer models than expected, check the path is under a configured root and re-request (scan runs per call).
