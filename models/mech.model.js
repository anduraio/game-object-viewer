// Built-in demo model: the blocky training mech from the original viewer.
// Feet at y=0, facing +Z (the viewer's "front").
registerGovModel('Training Mech', ({ THREE }) => {
  const matGun = new THREE.MeshStandardMaterial({ color: 0x9aa6b8, metalness: .65, roughness: .4 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x39414f, metalness: .5, roughness: .55 });
  const matAcc = new THREE.MeshStandardMaterial({ color: 0xff7a1a, metalness: .3, roughness: .45, emissive: 0x3a1400 });
  const matGlow = new THREE.MeshStandardMaterial({ color: 0x0a2a30, emissive: 0x2fd8f0, emissiveIntensity: 1.5 });

  const bot = new THREE.Group();
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    bot.add(m);
    return m;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const C = (r, h) => new THREE.CylinderGeometry(r, r, h, 16);
  const S = r => new THREE.SphereGeometry(r, 20, 14);

  add(B(.95, .42, .58), matDark, 0, 1.28, 0);          // pelvis
  add(B(1.25, .85, .75), matGun, 0, 2.1, 0);           // torso
  add(B(.85, .5, .12), matAcc, 0, 2.2, .42);           // chest plate
  add(B(.7, .18, .5), matDark, 0, 2.6, 0);             // collar
  add(B(.46, .4, .46), matGun, 0, 2.9, 0);             // head
  add(B(.34, .12, .06), matGlow, 0, 2.92, .24);        // visor
  add(C(.02, .32), matDark, .17, 3.24, 0);             // antenna
  add(S(.035), matGlow, .17, 3.42, 0);                 // antenna tip

  for (const s of [-1, 1]) {
    add(B(.42, .4, .5), matGun, s * .85, 2.42, 0);     // shoulder
    add(B(.5, .16, .56), matAcc, s * .85, 2.66, 0);    // shoulder pad
    add(C(.13, .5), matDark, s * .9, 2.05, 0);         // upper arm
    add(S(.14), matGun, s * .9, 1.82, 0);              // elbow
    add(B(.26, .5, .3), matGun, s * .93, 1.5, .03);    // forearm
    add(S(.16), matDark, s * .93, 1.18, .03);          // fist
    add(C(.17, .55), matGun, s * .33, 1.0, 0);         // thigh
    add(B(.3, .16, .34), matDark, s * .33, .68, .02);  // knee
    add(B(.3, .55, .34), matGun, s * .33, .36, .02);   // shin
    add(B(.24, .4, .05), matAcc, s * .33, .38, .2);    // shin plate
    add(B(.38, .18, .72), matDark, s * .33, .09, .08); // foot
  }
  add(B(.85, .65, .28), matDark, 0, 2.25, -.52);       // backpack
  for (const s of [-1, 1]) {
    add(C(.11, .32), matGun, s * .28, 1.85, -.6);      // thruster
    add(C(.08, .06), matGlow, s * .28, 1.68, -.6);     // nozzle glow
  }
  return bot;
});
