// Built-in demo model: a small scout ship. Nose toward +Z.
registerGovModel('Scout Ship', ({ THREE }) => {
  const matHull = new THREE.MeshStandardMaterial({ color: 0x8d99ad, metalness: .7, roughness: .35 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x333c4c, metalness: .6, roughness: .5 });
  const matAcc = new THREE.MeshStandardMaterial({ color: 0xff7a1a, metalness: .35, roughness: .45 });
  const matGlow = new THREE.MeshStandardMaterial({ color: 0x08202a, emissive: 0x35e0ff, emissiveIntensity: 1.6 });
  const matThrust = new THREE.MeshStandardMaterial({ color: 0x30140a, emissive: 0xff7a1a, emissiveIntensity: 1.8 });

  const ship = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    ship.add(m);
    return m;
  };

  // fuselage: three tapered sections, nose at +Z
  add(new THREE.CylinderGeometry(.42, .55, 1.7, 10), matHull, 0, 0, .5, Math.PI / 2);
  add(new THREE.CylinderGeometry(.55, .34, 1.3, 10), matHull, 0, 0, -1.0, Math.PI / 2);
  add(new THREE.ConeGeometry(.42, .9, 10), matHull, 0, 0, 1.8, Math.PI / 2);
  // cockpit
  add(new THREE.SphereGeometry(.3, 18, 12), matDark, 0, .42, .75, -.15);
  add(new THREE.BoxGeometry(.4, .1, .5), matGlow, 0, .5, .85, -.15);
  // swept wings
  for (const s of [-1, 1]) {
    const wing = add(new THREE.BoxGeometry(1.7, .09, .95), matHull, s * 1.05, -.05, -.55, 0, s * -.28);
    add(new THREE.BoxGeometry(.12, .42, .5), matAcc, s * 1.83, .12, -1.02, 0, s * -.28);  // wingtip fin
    // engines under the wings
    add(new THREE.CylinderGeometry(.17, .2, .85, 10), matDark, s * .78, -.14, -.9, Math.PI / 2);
    add(new THREE.CylinderGeometry(.12, .17, .1, 10), matThrust, s * .78, -.14, -1.36, Math.PI / 2);
  }
  // dorsal spine + tail
  add(new THREE.BoxGeometry(.18, .3, 1.6), matAcc, 0, .5, -.7);
  add(new THREE.BoxGeometry(.12, .8, .7), matHull, 0, .5, -1.55, .35);
  add(new THREE.BoxGeometry(.5, .08, .06), matGlow, 0, .35, .28);   // hull light strip
  return ship;
});
