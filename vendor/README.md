Vendored third-party builds — both MIT licensed, full texts in this folder:

- three.min.js, three.module.js — three.js (https://github.com/mrdoob/three.js),
  r128 UMD global (viewer renderer) and r170 ESM (the import-map target game
  modules resolve their `import 'three'` against). licenses/three.js-LICENSE.
- GLTFLoader.js, OBJLoader.js, STLLoader.js, PLYLoader.js, FBXLoader.js —
  three.js examples/js loaders, same three.js r128 build line, same license.
- fflate.min.js — fflate 0.6.10 UMD (https://github.com/101arrowz/fflate),
  required by FBXLoader. licenses/fflate-LICENSE.

They are vendored rather than depended on so the tool stays zero-dependency
and runs from a plain file tree with no install or build step. Replace any of
them by serving your own builds and pointing the script tags / import map in
public/index.html elsewhere.
