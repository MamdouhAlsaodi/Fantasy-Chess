/* The 3D battlefield is one continuous world: rolling terrain rising into
   distant highlands, blended into a realm sky. No photo backdrop. */
(function (root) {
  "use strict";
  const T = root.THREE;
  const COLORS = {
    highlands: [0x3d6334, 0x86b464, 0x2a4a2e],
    volcano: [0x4a3c3e, 0x7a5c55, 0x241722],
    glacier: [0x4a8ea2, 0xb8e6e6, 0x1d4560],
    citadels: [0x6d8496, 0xbebfae, 0x54636f],
    desert: [0xb0854e, 0xeccb84, 0x8a5f39],
  };
  // Distant sky gradients: horizon tone first, zenith tone last.
  const SKIES = {
    highlands: ["#cfe4c2", "#8fb7d4", "#5d84a8"],
    volcano: ["#b0766a", "#5b3a4a", "#1c1424"],
    glacier: ["#e4f4f6", "#9cc9e4", "#57809f"],
    citadels: ["#f2e3c4", "#a9c2dc", "#6d89a8"],
    desert: ["#f4dfae", "#d9a86a", "#96683f"],
  };
  function mesh(geometry, mat, x, y, z) {
    const item = new T.Mesh(geometry, mat);
    item.position.set(x, y, z);
    item.castShadow = false;
    item.receiveShadow = true;
    return item;
  }
  function add(root3d, objects, object) {
    root3d.add(object);
    objects.push(object);
    return object;
  }
  function terrainHeight(x, z, realm) {
    // Flat, clear field for the armies; land rolls upward toward the horizon.
    const distance = Math.max(Math.abs(x), Math.abs(z));
    const rise = Math.max(0, Math.min(1, (distance - 4.4) / 5.5));
    const waves = Math.sin(x * .74 + z * .33) * Math.cos(z * .57 - x * .12);
    return -.5 + rise * rise * (3.1 + waves * 1.35);
  }
  function fieldMask(x, z) {
    // 1 inside the playable field, easing to 0 across its border.
    const distance = Math.max(Math.abs(x), Math.abs(z));
    const field = Math.max(0, Math.min(1, (7.2 - distance) / 2.8));
    return field * field * (3 - 2 * field);
  }
  function skyTexture(realm) {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const tones = SKIES[realm] || SKIES.highlands;
    const gradient = ctx.createLinearGradient(0, 256, 0, 0);
    gradient.addColorStop(0, tones[0]);
    gradient.addColorStop(.45, tones[1]);
    gradient.addColorStop(1, tones[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 256);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return texture;
  }
  const realmTexture = (lava) => flowTexture(lava);
  function landscape(parent, objects, realm, groundTexture) {
    const shades = COLORS[realm];
    const ground = new T.PlaneGeometry(90, 90, 96, 96);
    ground.rotateX(-Math.PI / 2);
    const pos = ground.getAttribute("position");
    const colors = [];
    const near = new T.Color(shades[0]);
    const bright = new T.Color(shades[1]);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z, realm));
      const distance = Math.max(Math.abs(x), Math.abs(z));
      const rise = Math.max(0, Math.min(1, (distance - 4.4) / 5.5));
      const waves = Math.sin(x * .74 + z * .33) * Math.cos(z * .57 - x * .12);
      const tint = near.clone().lerp(bright, Math.max(.04, Math.min(.9, .37 + waves * .2 + rise * .25)));
      colors.push(tint.r, tint.g, tint.b);
    }
    ground.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    // Texture density: subtle world-scale grain, uniform for a seamless field.
    const uv = ground.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, pos.getX(i) / 14, pos.getZ(i) / 14);
    }
    ground.computeVertexNormals();
    add(parent, objects, mesh(ground, new T.MeshStandardMaterial({
      map: groundTexture, vertexColors: true, roughness: .96,
    }), 0, 0, 0));
  }
  function flowTexture(lava) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const base = ctx.createLinearGradient(0, 0, 128, 0);
    if (lava) {
      base.addColorStop(0, "#6d1809"); base.addColorStop(.5, "#ff5f12"); base.addColorStop(1, "#801a08");
    } else {
      base.addColorStop(0, "#125b79"); base.addColorStop(.5, "#a0edfc"); base.addColorStop(1, "#207da5");
    }
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 85; i++) {
      const x = (i * 73) % 128, y = (i * 47) % 256;
      ctx.strokeStyle = lava ? (i % 3 ? "#ffca5b88" : "#390e0988") : "#efffff77";
      ctx.lineWidth = .7 + i % 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 11, y + 7, x - 9, y + 15, x + 7, y + 26);
      ctx.stroke();
    }
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(1, 3);
    return texture;
  }
  function streamGeometry(curve) {
    const verts = [], uvs = [], indices = [];
    for (let i = 0; i <= 64; i++) {
      const point = curve.getPoint(i / 64);
      const tangent = curve.getTangent(i / 64);
      const side = new T.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(.28);
      for (const direction of [-1, 1]) {
        verts.push(point.x + side.x * direction, point.y + .03, point.z + side.z * direction);
        uvs.push(direction < 0 ? 0 : 1, i / 64);
      }
      if (i < 64) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.parameters = { path: curve };
    return geometry;
  }
  function stream(parent, objects, x, z, name, realm) {
    const curve = new T.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => {
      const xx = x + Math.sin(i * 1.45) * .7;
      const zz = z + i * .48;
      return new T.Vector3(xx, terrainHeight(xx, zz, realm) + .06, zz);
    }));
    const flow = mesh(streamGeometry(curve), new T.MeshBasicMaterial({
      map: flowTexture(realm === "volcano"), transparent: true, opacity: .9,
      side: T.DoubleSide, depthWrite: false,
    }), 0, 0, 0);
    flow.userData.landmark = name;
    add(parent, objects, flow);
  }
  function glacialFlow(parent, objects) {
    // Keep the meltwater on the ground rather than suspending a block cliff over the horizon.
    stream(parent, objects, -6, -2.2, "glacial-river", "glacier");
  }
  function squareCenter(square) {
    return {
      x: square.charCodeAt(0) - 97 - 3.5,
      z: 3.5 - (+square[1] - 1),
    };
  }
  function markedSquares(parent, objects, realm, first, second) {
    // Two landmark squares carry grounded stones and a clearly readable frame.
    [first, second].forEach((square) => {
      const center = squareCenter(square);
      const frame = mesh(new T.RingGeometry(.46, .5, 4), new T.MeshBasicMaterial({
        color: 0xf2dfae, transparent: true, opacity: .62, side: T.DoubleSide, depthWrite: false,
      }), center.x, terrainHeight(center.x, center.z, realm) + .02, center.z);
      frame.rotation.x = -Math.PI / 2;
      frame.rotation.z = Math.PI / 4;
      frame.userData.decoration = "rocks";
      frame.userData.square = square;
      frame.userData.border = true;
      add(parent, objects, frame);
      const count = 3;
      for (let i = 0; i < count; i++) {
        const angle = i * 2.4 + square.charCodeAt(0);
        const radius = .16 + (i % 2) * .1;
        const xx = center.x + Math.cos(angle) * radius;
        const zz = center.z + Math.sin(angle) * radius;
        const stone = mesh(new T.DodecahedronGeometry(.09 + i % 2 * .05, 0),
          new T.MeshStandardMaterial({
            color: realm === "desert" ? 0xb79a6c : (realm === "volcano" ? 0x3d3038 : 0x8e9291),
            roughness: .92,
          }), xx, 0, zz);
        stone.position.y = terrainHeight(xx, zz, realm) + .05;
        stone.rotation.set(i * 1.3, i * .8, i * .4);
        stone.userData.decoration = "rocks";
        stone.userData.square = square;
        add(parent, objects, stone);
      }
    });
  }
  function build(root3d, scene, realm, groundTexture) {
    const objects = [];
    const oldSky = scene.background;
    if (oldSky && oldSky.isTexture) oldSky.dispose();
    // A 90-unit world with its own sky and distance haze replaces the photo backdrop.
    scene.background = skyTexture(realm);
    scene.fog = new T.Fog(new T.Color(SKIES[realm][0]).getHex(), 30, 95);
    landscape(root3d, objects, realm, groundTexture);
    if (realm === "highlands") {
      stream(root3d, objects, -6, -2.2, "meadow-stream", "highlands");
      markedSquares(root3d, objects, realm, "c4", "f5");
    } else if (realm === "volcano") {
      stream(root3d, objects, -6, -2.2, "lava-river", "volcano");
      markedSquares(root3d, objects, realm, "d5", "e4");
    } else if (realm === "glacier") {
      glacialFlow(root3d, objects);
      markedSquares(root3d, objects, realm, "c4", "f5");
    }
    return objects;
  }
  function animate(objects, time) {
    for (const item of objects) {
      if (["lava-river", "glacial-river", "meadow-stream"].includes(item.userData.landmark)) {
        item.material.map.offset.y = (time * (item.userData.landmark === "lava-river" ? .18 : .11)) % 1;
        item.material.opacity = .78 + Math.sin(time * 2) * .1;
      }
    }
  }
  root.FantasyChess = root.FantasyChess || {};
  root.FantasyChess.TerrainWorlds = { build, animate };
})(window);
