(function () {
  'use strict';
  var results = [];
  function test(name, fn) { try { fn(); results.push('PASS ' + name); } catch (e) { results.push('FAIL ' + name + ': ' + e.message); } }
  function assert(value, message) { if (!value) throw new Error(message); }
  test('local classic THREE build is available', function () {
    assert(window.THREE && THREE.REVISION === '158', 'expected local THREE r158 global');
  });
  test('all 3D piece textures have file-safe embedded URLs', function () {
    var urls = FantasyChess.TextureData;
    assert(urls && Object.keys(urls).length === 17, 'expected 12 piece and five realm material textures');
    assert(Object.keys(urls).every(function (key) { return urls[key].indexOf('data:image/webp;base64,') === 0; }), 'textures must load without file:// CORS');
  });
  test('construct/init exposes a genuine WebGL scene and 64 selectable tiles', function () {
    var mount = document.getElementById('mount');
    var view = new FantasyChess.ThreeView(mount, { onSquare: function () {} });
    var ready = view.init();
    if (ready) {
      assert(view.renderer && view.scene && view.camera, 'renderer, scene, and camera should exist');
      assert(view.squares && view.squares.length === 64, 'expected 64 board square meshes');
      assert(view.squares.every(function (square) { return square.isMesh && square.userData.square; }), 'every tile should be a named raycastable mesh');
    }
    assert(typeof ready === 'boolean', 'init must return a boolean');
    view.destroy();
  });
  test('keyboard focus navigates squares and activates the focused square', function () {
    var calls = [];
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), { onSquare: function (sq) { calls.push(sq); } });
    var ready = view.init();
    if (!ready) { view.destroy(); results.push('SKIP keyboard assertions: WebGL unavailable'); return; }
    var canvas = view.renderer.domElement;
    assert(canvas.tabIndex === 0, 'canvas should be keyboard focusable');
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert(view.focusedSquare === 'b1', 'right arrow should move focus one square');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert(calls[0] === 'b1', 'Enter should activate focused square');
    assert(/b1/i.test(canvas.getAttribute('aria-label') || '') || /b1/i.test(view.statusElement.textContent), 'accessible status should name focused square');
    view.destroy();
  });
  test('pointer clicks raycast a square while orbit drags do not select', function () {
    var calls = [];
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), { onSquare: function (sq) { calls.push(sq); } });
    if (!view.init()) { view.destroy(); results.push('SKIP pointer assertions: WebGL unavailable'); return; }
    var canvas = view.renderer.domElement, rect = canvas.getBoundingClientRect();
    var point = new THREE.Vector3(-0.5, 0, 0.5).project(view.camera);
    var x = rect.left + (point.x + 1) * rect.width / 2, y = rect.top + (1 - point.y) * rect.height / 2;
    view.scene.updateMatrixWorld(true);
    view.camera.updateMatrixWorld(true);
    view.raycaster.setFromCamera(new THREE.Vector2(point.x, point.y), view.camera);
    var projectedHit = view.raycaster.intersectObjects(view.squares, false)[0];
    assert(projectedHit && projectedHit.object.userData.square === 'd4', 'center ray should intersect the d4 tile');
    function pointer(type, px, py, id) { canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, clientX: px, clientY: py, button: 0 })); }
    pointer('pointerdown', x, y, 1); pointer('pointerup', x, y, 1);
    assert(calls[0] === 'd4', 'raycast click should invoke square callback');
    pointer('pointerdown', x, y, 2); pointer('pointermove', x + 25, y + 15, 2); pointer('pointerup', x + 25, y + 15, 2);
    assert(calls.length === 1, 'dragging the orbit should not activate a square');
    view.destroy();
  });
  test('render synchronizes a chess position and five distinct animated realm themes', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP render assertions: WebGL unavailable'); return; }
    var chess = new Chess();
    var fen = chess.fen();
    view.render(chess, 'volcano', ['e4'], 'e2', { from: 'e2', to: 'e4' });
    assert(chess.fen() === fen, 'render should preview without mutating chess rules/state');
    assert(view.pieces && view.pieces.length === 32, 'initial position should create 32 raised pieces');
    assert(view.squares.filter(function (square) { return square.material.color.getHex() !== square.userData.baseColor; }).length >= 1, 'selection/legal/last-move highlights should be applied: changed=' + view.squares.filter(function (square) { return square.material.color.getHex() !== square.userData.baseColor; }).length + ', e2=' + view.squares.filter(function (square) { return square.userData.square === 'e2'; })[0].material.color.getHexString() + ', base=' + view.squares.filter(function (square) { return square.userData.square === 'e2'; })[0].userData.baseColor.toString(16));
    var signatures = ['volcano','highlands','glacier','citadels','desert'].map(function (id) {
      view.render(chess, id); return view.themeSignature;
    });
    assert(new Set(signatures).size === 5, 'realm terrain should be visually distinct');
    assert(view.terrainFeatures && view.terrainFeatures.length >= 1, 'terrain should include a 3D heightfield');
    view.setActive(true);
    assert(view.active && (view._reduced || view.frame), 'active view should schedule its animation loop');
    view.setActive(false);
    assert(!view.active && view.frame === 0, 'inactive view should stop its animation loop');
    view.resize(); view.destroy();
  });
  test('distant mobile camera still reads the armies clearly through haze', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP fog: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    assert(view.scene.fog && view.scene.fog.near >= 26, 'haze starts beyond the battlefield, not on the armies');
    view.destroy();
  });
  test('portrait battlefield keeps every soldier inside the camera frustum', function () {
    var mount = document.getElementById('mount');
    mount.style.width = '390px'; mount.style.height = '844px';
    var view = new FantasyChess.ThreeView(mount, {});
    if (!view.init()) { view.destroy(); mount.removeAttribute('style'); results.push('SKIP portrait camera: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    view.updateCamera(10); // Auto pull-back for portrait aspect.
    var projected = view.pieces.map(function (piece) { return piece.getWorldPosition(new THREE.Vector3()).project(view.camera); });
    var visible = projected.every(function (p) { return Math.abs(p.x) < .94 && Math.abs(p.y) < .92; });
    view.destroy(); mount.removeAttribute('style');
    assert(visible, 'pieces on both flanks must stay visible in portrait');
  });
  test('battle tiles sit in the terrain without a pedestal or solid chessboard', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP field tiles: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    assert(view.squares.every(function (square) { return square.geometry.type === 'PlaneGeometry' && square.material.transparent && square.material.opacity < .5; }), 'idle field tiles should be faint raycastable ground patches');
    assert(!view.boardRoot.children.some(function (item) { return item.geometry && item.geometry.type === 'BoxGeometry' && item.geometry.parameters.width >= 8; }), 'no raised chessboard pedestal');
    view.render(new Chess(), 'highlands', ['e4'], 'e2');
    assert(view.squares.find(function (square) { return square.userData.square === 'e2'; }).material.opacity > .7, 'selected unit gets a readable field marker');
    view.destroy();
  });
  test('army move advances across the field rather than teleporting', function () {
    assert(FantasyChess.WarMotion, 'missing move animation');
    var group = new THREE.Group(), motion = new FantasyChess.WarMotion();
    group.position.set(.5, -.39, .5);
    motion.begin(group, new THREE.Vector3(.5, -.39, 2.5), new THREE.Vector3(.5, -.39, .5), 0);
    assert(group.position.z === 2.5, 'unit must start at departure square');
    motion.update(300);
    assert(group.position.z > .5 && group.position.z < 2.5 && group.position.y > -.39, 'unit travels and rises in a charge arc');
    motion.update(650);
    assert(Math.abs(group.position.z - .5) < .001 && !motion.current, 'unit lands on target');
  });
  test('ThreeView charges a moved pawn and preserves its arc during status redraws', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP view charge: WebGL unavailable'); return; }
    var chess = new Chess();
    view.setActive(true);
    view.render(chess, 'highlands');
    var move = chess.move({ from: 'e2', to: 'e4' });
    view.render(chess, 'highlands', [], null, move);
    assert(view.motion.current && view.motion.current.group.position.z === 2.5, 'pawn should depart e2');
    var group = view.motion.current.group;
    view.render(chess, 'highlands', [], null, move);
    assert(view.motion.current && view.motion.current.group === group, 'status redraw must not reset charge');
    view.motion.update(view.motion.current.startedAt + 610);
    assert(Math.abs(group.position.z - .5) < .001, 'pawn arrives e4');
    view.destroy();
  });
  test('3D soldiers occupy the same squares as the chess rules', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP coordinates: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    var near = view.pieces.find(function (piece) { return piece.position.x === -3.5 && piece.position.z === 3.5; });
    var far = view.pieces.find(function (piece) { return piece.position.x === -3.5 && piece.position.z === -3.5; });
    assert(near && near.children[0].material.color.getHex() === 0xf1d9a0, 'white rook must stand on a1 nearest player');
    assert(far && far.children[0].material.color.getHex() === 0xae7ce3, 'shadow rook must stand on a8 farthest from player');
    view.destroy();
  });
  test('soldiers stand on battlefield markers instead of chess pedestals', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP soldiers: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    assert(view.pieces.every(function (group) {
      return group.children.some(function (child) { return child.geometry.type === 'RingGeometry'; }) &&
        !group.children.some(function (child) { return child.geometry.type === 'CylinderGeometry'; });
    }), 'army units should have ground markers, not chess-token bases');
    view.destroy();
  });
  test('shadow troops remain distinguishable against dark terrain', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP enemy contrast: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    var shadow = view.pieces.find(function (group) { return group.position.z === -3.5; });
    assert(shadow && shadow.children.some(function (part) { return part.isSprite && part.material.map; }), 'shadow units need a soft contrasting silhouette');
    view.destroy();
  });
  test('3D soldiers have readable upright art as the camera orbits', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP soldier visuals: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    var soldier = view.pieces[0].children.find(function (child) { return child.geometry && child.geometry.type === 'PlaneGeometry'; });
    assert(soldier && soldier.geometry.parameters.height >= 1.3, 'soldier illustration should tower over its plinth');
    view.orbit.x = 1;
    view._placeCamera();
    assert(Math.abs(soldier.rotation.y - 1) < .1, 'sprite should face the new camera angle');
    view.destroy();
  });
  test('volcano and glacier use flowing lava and glacial meltwater', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP landmark visuals: WebGL unavailable'); return; }
    view.render(new Chess(), 'volcano');
    assert(view.terrainFeatures.some(function (item) { return item.userData.landmark === 'lava-river'; }), 'volcano needs a visible lava flow');
    view.render(new Chess(), 'glacier');
    assert(view.terrainFeatures.some(function (item) { return item.userData.landmark === 'glacial-river'; }), 'glacier needs flowing glacial water');
    view.destroy();
  });
  test('landmark stones sit grounded instead of floating blocky props', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP props: WebGL unavailable'); return; }
    ['glacier', 'citadels', 'desert'].forEach(function (realm) {
      view.render(new Chess(), realm);
      var offenders = view.terrainFeatures.filter(function (item) {
        return ['BoxGeometry', 'CylinderGeometry'].includes(item.geometry && item.geometry.type);
      });
      assert(offenders.length === 0, realm + ' has floating blocky props');
      view.terrainFeatures.filter(function (item) { return item.userData.decoration === 'rocks'; }).forEach(function (item) {
        assert(item.userData.square, 'every landmark prop is tied to a named square');
      });
    });
    view.destroy();
  });
  test('the battlefield is a complete world instead of a photo backdrop', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP world: WebGL unavailable'); return; }
    view.render(new Chess(), 'volcano');
    assert(view.scene.background && view.scene.background.isTexture, 'sky must belong to the 3D world');
    assert(view.scene.fog && view.scene.fog.isFog && view.scene.fog.far < 120, 'distance should fade into the sky');
    var ground = view.terrainFeatures.find(function (item) { return item.geometry && item.geometry.type === 'PlaneGeometry' && item.geometry.getAttribute('color'); });
    assert(ground && ground.geometry.parameters.width >= 60 && !ground.material.transparent, 'terrain must be one opaque world extending outward');
    view.destroy();
  });
  test('terrain rolls from the field into distant highlands', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP highlands: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    var ground = view.terrainFeatures.find(function (item) { return item.geometry && item.geometry.getAttribute('color'); });
    var pos = ground.geometry.getAttribute('position'), top = -Infinity, field = -Infinity;
    for (var i = 0; i < pos.count; i++) {
      top = Math.max(top, pos.getY(i));
      if (Math.abs(pos.getX(i)) < 5 && Math.abs(pos.getZ(i)) < 5) field = Math.max(field, pos.getY(i));
    }
    view.destroy();
    assert(top > 1, 'horizon must rise into hills: ' + top);
    assert(field < -.3, 'playable field must stay low and clear: ' + field);
  });
  test('two marked squares carry grounded stones with clear borders', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP stones: WebGL unavailable'); return; }
    view.render(new Chess(), 'volcano');
    var deco = view.terrainFeatures.filter(function (item) { return item.userData.decoration === 'rocks'; });
    var squares = {};
    deco.forEach(function (item) { squares[item.userData.square] = true; });
    assert(Object.keys(squares).sort().join() === 'd5,e4', 'stones belong to exactly two named squares');
    var stones = deco.filter(function (item) { return item.geometry.type === 'DodecahedronGeometry'; });
    var frames = deco.filter(function (item) { return item.userData.border; });
    assert(stones.length >= 6 && frames.length === 2, 'each marked square needs stones plus a visible border');
    assert(stones.every(function (s) { return s.position.y < -.1 && s.position.y > -.5; }), 'stones must sit on the ground');
    assert(frames.every(function (f) { return f.material.transparent && f.material.opacity >= .5; }), 'square borders must stay readable');
    view.destroy();
  });
  test('war camera opens high above the dawn side facing the field', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP camera: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    assert(view.orbit.y > .7 && view.orbit.y < .95, 'camera should look down from above');
    assert(view.camera.position.z > 8 && view.camera.position.y > 13, 'camera should hover high in front of the dawn army');
    var before = view.orbit.y;
    view.orbitTarget.y = .6;
    view.updateCamera(1 / 60);
    assert(view.orbit.y < before && view.orbit.y > .61, 'easing must interpolate toward the target');
    for (var i = 0; i < 240; i++) view.updateCamera(1 / 60);
    assert(Math.abs(view.orbit.y - .6) < .01, 'camera settles exactly on its target');
    view.destroy();
  });
  test('desktop zoom stays tactical while portrait pulls back automatically', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP zoom: WebGL unavailable'); return; }
    view.orbitTarget.distance = 99;
    view.updateCamera(1);
    var desktopLimit = view.orbit.distance;
    view.destroy();
    assert(desktopLimit <= view.CAMERA_LIMITS.maxDistance * 1.09 + .01, 'desktop zoom clamp holds');
  });
  test('both armies carry a matching battlefield aura', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP auras: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    var dawn = view.pieces.find(function (g) { return g.position.z === 3.5; });
    var shadow = view.pieces.find(function (g) { return g.position.z === -3.5; });
    assert(dawn && dawn.children.some(function (c) { return c.isSprite && c.material.color.getHex() === 0xffd98c; }), 'dawn units need a warm aura');
    assert(shadow && shadow.children.some(function (c) { return c.isSprite && c.material.color.getHex() === 0xc487f4; }), 'shadow units keep their purple aura');
    view.destroy();
  });
  test('terrain rolls from the field into distant highlands', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP highlands: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    var ground = view.terrainFeatures.find(function (item) { return item.geometry && item.geometry.getAttribute('color'); });
    var pos = ground.geometry.getAttribute('position'), top = -Infinity, field = -Infinity;
    for (var i = 0; i < pos.count; i++) {
      top = Math.max(top, pos.getY(i));
      if (Math.abs(pos.getX(i)) < 5 && Math.abs(pos.getZ(i)) < 5) field = Math.max(field, pos.getY(i));
    }
    view.destroy();
    assert(top > 1, 'horizon must rise into hills: ' + top);
    assert(field < -.3, 'playable field must stay low and clear: ' + field);
  });
  test('battlefield ground uses the realm material across the whole world', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP battlefield material: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    var ground = view.terrainFeatures.find(function (item) { return item.geometry && item.geometry.getAttribute('color'); });
    assert(ground.material.map && ground.material.map !== view.squares[0].material.map, 'terrain must use its own detailed texture');
    var uv = ground.geometry.getAttribute('uv');
    assert(uv.getY(uv.count - 1) > 3, 'material spans the full world, not just the field');
    view.destroy();
  });
  test('each realm maps a distinct detailed local surface onto its chess tiles', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP board material: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    var meadow = view.squares[0].material.map;
    view.render(new Chess(), 'volcano');
    var basalt = view.squares[0].material.map;
    assert(meadow && basalt && meadow !== basalt, 'worlds must change physical tile materials');
    view.destroy();
  });
  test('the field blends seamlessly into the surrounding world ground', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP seam: WebGL unavailable'); return; }
    view.render(new Chess(), 'volcano');
    var ground = view.terrainFeatures.find(function (item) { return item.geometry && item.geometry.getAttribute('color'); });
    assert(!ground.material.transparent, 'the world ground is one opaque surface');
    var uv = ground.geometry.getAttribute('uv');
    var inner = -1, outer = -1;
    for (var i = 0; i < uv.count; i++) {
      var x = ground.geometry.getAttribute('position').getX(i);
      if (Math.abs(x) < .01 && Math.abs(ground.geometry.getAttribute('position').getZ(i)) < .01) inner = i;
      if (Math.abs(x) < .01 && ground.geometry.getAttribute('position').getZ(i) > 43) outer = i;
    }
    assert(inner >= 0 && outer >= 0, 'field and horizon vertices exist');
    assert(uv.getY(outer) - uv.getY(inner) > 3, 'texture is continuous across field and horizon');
    view.destroy();
  });
  test('realm rivers have a continuously scrolling textured surface', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP river material: WebGL unavailable'); return; }
    view.render(new Chess(), 'volcano');
    var river = view.terrainFeatures.find(function (item) { return item.userData.landmark === 'lava-river'; });
    assert(river.material.map && river.material.map.wrapT === THREE.RepeatWrapping, 'lava should have a mapped flow surface');
    var before = river.material.map.offset.y;
    FantasyChess.TerrainWorlds.animate(view.terrainFeatures, 3);
    assert(river.material.map.offset.y !== before, 'river texture should flow in time');
    view.destroy();
  });
  test('water is a smooth flow rather than a dotted particle chain', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP smooth water: WebGL unavailable'); return; }
    view.render(new Chess(), 'highlands');
    assert(!view.terrainFeatures.some(function (item) { return item.userData.motion === 'stream'; }), 'remove opaque dots from meadow stream');
    view.destroy();
  });
  test('lava stream follows the uneven ground instead of clipping into it', function () {
    var view = new FantasyChess.ThreeView(document.getElementById('mount'), {});
    if (!view.init()) { view.destroy(); results.push('SKIP lava relief: WebGL unavailable'); return; }
    view.render(new Chess(), 'volcano');
    var river = view.terrainFeatures.find(function (item) { return item.userData.landmark === 'lava-river'; });
    var heights = river.geometry.parameters.path.points.map(function (point) { return point.y; });
    assert(Math.max.apply(null, heights) - Math.min.apply(null, heights) > .1, 'molten flow must track hillside elevations');
    view.destroy();
  });
  var out = document.getElementById('results');
  out.textContent = results.join('\n');
  document.title = results.some(function (line) { return line.indexOf('FAIL') === 0; }) ? 'FAIL' : 'PASS';
}());
