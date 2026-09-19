// Built-in demo model: a reinforced cargo crate.
registerGovModel('Cargo Crate', ({ THREE }) => {
  const matShell = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: .55, roughness: .5 });
  const matFrame = new THREE.MeshStandardMaterial({ color: 0x2c3542, metalness: .7, roughness: .35 });
  const matAcc = new THREE.MeshStandardMaterial({ color: 0xff7a1a, metalness: .3, roughness: .5 });
  const matGlow = new THREE.MeshStandardMaterial({ color: 0x08202a, emissive: 0x35e0ff, emissiveIntensity: 1.4 });

  const crate = new THREE.Group();
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    crate.add(m);
    return m;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const S = 1.3;                    // crate edge, sits 0..S tall
  const h = S / 2;                  // mid-height
  const e = .16, L = S + .04;       // frame bar cross-section / length

  add(B(S, S, S), matShell, 0, h, 0);                            // shell
  for (const sx of [-1, 1]) for (const y of [0, S]) {
    add(B(L, e, e), matFrame, 0, y, sx * h);                     // X edges, front + back
    add(B(e, e, L), matFrame, sx * h, y, 0);                     // Z edges, left + right
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(B(e, L, e), matFrame, sx * h, h, sz * h);                // vertical corner posts
    add(B(.3, .26, .3), matAcc, sx * h, h, sz * h);              // mid-post collar clamps
  }
  add(B(.5, .14, .06), matGlow, 0, S - .1, h + .02);             // status strip (top front)
  add(B(.34, .5, .08), matFrame, 0, h, h + .05);                 // front latch plate
  add(B(.1, .18, .06), matAcc, 0, h, h + .1);                    // latch
  return crate;
});
