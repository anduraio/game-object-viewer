Vendored third-party files — all MIT licensed (texts in licenses/):

- three.module.js + three.core.js — three.js r186 ESM build
  (https://github.com/mrdoob/three.js). One three for everything: the
  viewer's renderer AND the import-map target that the games' own modules
  resolve their `import 'three'` against.
- three-addons/ — the examples/jsm modules the viewer and the games need,
  mirroring the `three/addons/` directory layout the import map maps to:
  loaders (GLTF, OBJ, STL, PLY, FBX), geometries/RoundedBoxGeometry,
  curves (NURBSCurve + NURBSUtils), utils (BufferGeometryUtils,
  SkeletonUtils), libs/fflate.module.js (FBX dependency).
- licenses/three.js-LICENSE, licenses/fflate-LICENSE — full license texts
  (fflate: https://github.com/101arrowz/fflate).

They are vendored rather than depended on so the tool stays zero-dependency
and runs from a plain file tree with no install or build step. To use a
different three version, replace three.module.js + three.core.js and the
addons here, and keep the import map in public/index.html pointing at them —
the version must match what the scanned games import.
