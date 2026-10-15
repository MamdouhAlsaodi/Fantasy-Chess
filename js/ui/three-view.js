(function(root) {
  'use strict';
  var THREE = root.THREE;
  var THEMES = {
    volcano: {
      signature: 'ember basalt lava',
      sky: 0x190f18,
      floor: 0x211a1a,
      light: 0xffc9a8,
      tiles: [0xd8b48f, 0x59352e],
      features: 12,
      kind: 'lava',
      asset: 'volcano',
      camera: {
        x: 0.46,
        y: .8,
        distance: 16,
        lookAt: [0, -.2, -1]
      }
    },
    highlands: {
      signature: 'emerald grass grove',
      sky: 0x9acb9b,
      floor: 0x385b35,
      light: 0xfff3d2,
      tiles: [0xe5dbb3, 0x4c5f3a],
      features: 24,
      kind: 'meadow',
      asset: 'highlands',
      camera: {
        x: 0.46,
        y: .78,
        distance: 16.5,
        lookAt: [0, -.2, -1]
      }
    },
    glacier: {
      signature: 'arctic glacier flowing water',
      sky: 0x96c9e0,
      floor: 0x285878,
      light: 0xe8f7ff,
      tiles: [0xe9f2f2, 0x5d7a8c],
      features: 10,
      kind: 'water',
      asset: 'glacier',
      camera: {
        x: 0.46,
        y: .8,
        distance: 16,
        lookAt: [0, -.2, -1]
      }
    },
    citadels: {
      signature: 'floating sky citadels',
      sky: 0x9bc9e8,
      floor: 0x567087,
      light: 0xfff0cf,
      tiles: [0xe8e3d4, 0x77808f],
      features: 7,
      kind: 'citadel',
      asset: 'citadels',
      camera: {
        x: 0.46,
        y: .78,
        distance: 16,
        lookAt: [0, -.2, -1]
      }
    },
    desert: {
      signature: 'ochre sand dunes',
      sky: 0xf1c382,
      floor: 0x997044,
      light: 0xffefc4,
      tiles: [0xf0d9a8, 0xa9825b],
      features: 16,
      kind: 'desert',
      asset: 'desert',
      camera: {
        x: 0.46,
        y: .85,
        distance: 15.5,
        lookAt: [0, -.2, -1]
      }
    }
  };
  var PIECES = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king'
  };

  function ThreeView(container, options) {
    this.container = container;
    this.options = options || {};
    this.onSquare = this.options.onSquare || function() {};
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.squares = [];
    this.pieces = [];
    this.terrainFeatures = [];
    this.themeSignature = '';
    this.statusElement = null;
    this.focusedSquare = 'a1';
    this.active = false;
    this.frame = 0;
    this.clock = null;
    this.raycaster = null;
    this.pointer = new THREE.Vector2();
    this.lastPointer = null;
    this.dragged = false;
    this.orbit = {
      x: 0.46,
      y: .8,
      distance: 16
    };
    this.orbitTarget = {
      x: 0.46,
      y: .8,
      distance: 16
    };
    this.CAMERA_LIMITS = {
      minDistance: 9,
      maxDistance: 24,
      minElevation: -.35,
      maxElevation: 1.25
    };
    this.lookAtTarget = new THREE.Vector3(0, -.2, 0);
    this._listeners = [];
    this._reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.textureCache = {};
    this.motion = new root.FantasyChess.WarMotion();
    this.positionKey = null;
  }
  ThreeView.prototype._listen = function(target, name, fn, opts) {
    target.addEventListener(name, fn, opts);
    this._listeners.push([target, name, fn, opts]);
  };
  ThreeView.prototype.init = function() {
    if (!THREE || !this.container || !THREE.WebGLRenderer) return false;
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power'
      });
    } catch (e) {
      this.renderer = null;
      return false;
    }
    var canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'رقعة شطرنج ثلاثية الأبعاد. الخانة المحددة a1. استخدم الأسهم للتنقل وEnter أو المسافة للاختيار.');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    this.container.appendChild(canvas);
    this.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.raycaster = new THREE.Raycaster();
    this.hemiLight = new THREE.HemisphereLight(0xe5f2ff, 0x453224, 2.1);
    this.scene.add(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(0xffefcf, 2.7);
    this.sunLight.position.set(-5, 10, 7);
    this.scene.add(this.sunLight);
    this.boardRoot = new THREE.Group();
    this.scene.add(this.boardRoot);
    this._buildBoard();
    this.statusElement = document.createElement('span');
    this.statusElement.className = 'three-view-status';
    this.statusElement.setAttribute('role', 'status');
    this.statusElement.setAttribute('aria-live', 'polite');
    this.statusElement.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
    if (getComputedStyle(this.container).position === 'static') this.container.style.position = 'relative';
    this.container.appendChild(this.statusElement);
    this._bindControls();
    this.resize();
    this._placeCamera();
    return true;
  };
  ThreeView.prototype._buildBoard = function() {
    var geo = new THREE.PlaneGeometry(.98, .98);
    geo.rotateX(-Math.PI / 2);
    var matA = new THREE.MeshStandardMaterial({
        color: 0xb2a88b, roughness: .93, transparent: true, opacity: .28,
        depthWrite: false, side: THREE.DoubleSide
      }),
      matB = new THREE.MeshStandardMaterial({
        color: 0x484a4a, roughness: .93, transparent: true, opacity: .28,
        depthWrite: false, side: THREE.DoubleSide
      });
    for (var rank = 0; rank < 8; rank++)
      for (var file = 0; file < 8; file++) {
        var square = String.fromCharCode(97 + file) + (rank + 1),
          m = new THREE.Mesh(geo, (((file + rank) & 1) ? matB : matA).clone());
        m.position.set(file - 3.5, -.39, 3.5 - rank);
        m.userData.square = square;
        m.userData.baseColor = m.material.color.getHex();
        this.boardRoot.add(m);
        this.squares.push(m);
      }
    this.focusMarker = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), new THREE.MeshBasicMaterial({
      color: 0xffdf58,
      transparent: true,
      opacity: .55,
      side: THREE.DoubleSide,
      depthWrite: false
    }));
    this.focusMarker.rotation.x = -Math.PI / 2;
    this.focusMarker.visible = false;
    this.boardRoot.add(this.focusMarker);
  };
  ThreeView.prototype._bindControls = function() {
    var self = this,
      c = this.renderer.domElement;
    this._listen(c, 'keydown', function(e) {
      var f = self.focusedSquare.charCodeAt(0) - 97,
        r = +self.focusedSquare[1] - 1,
        handled = true;
      if (e.key === 'ArrowRight') f = Math.min(7, f + 1);
      else if (e.key === 'ArrowLeft') f = Math.max(0, f - 1);
      else if (e.key === 'ArrowUp') r = Math.min(7, r + 1);
      else if (e.key === 'ArrowDown') r = Math.max(0, r - 1);
      else if (e.key === 'Enter' || e.key === ' ') {
        self.onSquare(self.focusedSquare);
        e.preventDefault();
        return;
      } else handled = false;
      if (handled) {
        e.preventDefault();
        self.focusedSquare = String.fromCharCode(97 + f) + (r + 1);
        self._updateFocus();
      }
    });
    this._listen(c, 'pointerdown', function(e) {
      c.focus();
      self.lastPointer = {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        id: e.pointerId
      };
      self.dragged = false;
      try {
        c.setPointerCapture(e.pointerId);
      } catch (_) {};
    });
    this._listen(c, 'pointermove', function(e) {
      if (!self.lastPointer || e.pointerId !== self.lastPointer.id) return;
      var dx = e.clientX - self.lastPointer.x,
        dy = e.clientY - self.lastPointer.y;
      if (Math.abs(e.clientX - self.lastPointer.startX) + Math.abs(e.clientY - self.lastPointer.startY) > 5) self.dragged = true;
      if (self.dragged) {
        self.orbitTarget.x += dx * .006;
        self.orbitTarget.y = Math.max(self.CAMERA_LIMITS.minElevation, Math.min(self.CAMERA_LIMITS.maxElevation, self.orbitTarget.y + dy * .006));
        self.orbit.x = self.orbitTarget.x;
      }
      self.lastPointer.x = e.clientX;
      self.lastPointer.y = e.clientY;
    });
    this._listen(c, 'pointerup', function(e) {
      if (!self.lastPointer || e.pointerId !== self.lastPointer.id) return;
      if (!self.dragged) {
        var rect = c.getBoundingClientRect();
        self.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        self.scene.updateMatrixWorld(true);
        self.camera.updateMatrixWorld(true);
        self.raycaster.setFromCamera(self.pointer, self.camera);
        var hit = self.raycaster.intersectObjects(self.squares, false)[0];
        if (hit) self.onSquare(hit.object.userData.square);
      }
      self.lastPointer = null;
    });
    this._listen(c, 'pointercancel', function() {
      self.lastPointer = null;
    });
    this._listen(c, 'wheel', function(e) {
      e.preventDefault();
      self.orbitTarget.distance = Math.max(self.CAMERA_LIMITS.minDistance, Math.min(self.CAMERA_LIMITS.maxDistance, self.orbitTarget.distance + e.deltaY * .012));
    }, {
      passive: false
    });
    this._listen(root, 'resize', function() {
      self.resize();
    });
    if (root.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(function() {
        self.resize();
      });
      this.resizeObserver.observe(this.container);
    }
  };
  ThreeView.prototype._placeCamera = function() {
    if (!this.camera) return;
    var d = this.orbit.distance,
      el = this.orbit.y;
    this.camera.position.set(Math.sin(this.orbit.x) * d * Math.cos(el), Math.sin(el) * d + 2.4, Math.cos(this.orbit.x) * d * Math.cos(el));
    this.camera.lookAt(this.lookAtTarget);
    // Unit sprites stand upright: face the camera horizontally only.
    var flat = new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z);
    this.pieces.forEach(function(group) {
      group.children.forEach(function(part) {
        if (part.userData.billboard) part.rotation.y = Math.atan2(flat.x - part.getWorldPosition(new THREE.Vector3()).x, flat.z - part.getWorldPosition(new THREE.Vector3()).z);
      }, this);
    }, this);
    this.camera.updateMatrixWorld(true);
  };
  ThreeView.prototype.updateCamera = function(dt) {
    var smoothing = Math.max(0, Math.min(1, dt * 6.5));
    this.orbit.y += (this.orbitTarget.y - this.orbit.y) * smoothing;
    this.orbit.x += (this.orbitTarget.x - this.orbit.x) * smoothing;
    this.orbit.distance += (this.orbitTarget.distance - this.orbit.distance) * smoothing;
    // Portrait phones need extra pull-back; desktop keeps the tactical limit.
    var aspectBoost = Math.max(1, 1.45 / this.camera.aspect);
    var pull = this.orbitTarget.distance > this.CAMERA_LIMITS.maxDistance
      ? this.CAMERA_LIMITS.maxDistance * aspectBoost
      : this.CAMERA_LIMITS.maxDistance;
    this.orbit.distance = Math.max(this.CAMERA_LIMITS.minDistance,
      Math.min(pull, this.orbit.distance));
    this.orbit.y = Math.max(this.CAMERA_LIMITS.minElevation, Math.min(this.CAMERA_LIMITS.maxElevation, this.orbit.y));
    this._placeCamera();
  };
  ThreeView.prototype._updateFocus = function() {
    if (!this.focusMarker) return;
    var sq = this.focusedSquare,
      m = this.squares.find(function(x) {
        return x.userData.square === sq;
      });
    if (m) {
      this.focusMarker.position.set(m.position.x, -.36, m.position.z);
      this.focusMarker.visible = true;
    }
    var c = this.renderer.domElement;
    c.setAttribute('aria-label', 'رقعة شطرنج ثلاثية الأبعاد. الخانة المحددة ' + sq + '. استخدم الأسهم للتنقل وEnter أو المسافة للاختيار.');
    this.statusElement.textContent = 'الخانة ' + sq;
  };
  ThreeView.prototype._loadTexture = function(path) {
    var urls = root.FantasyChess && root.FantasyChess.TextureData,
      url = urls && urls[path];
    if (!url) throw new Error('3D texture missing: ' + path);
    var self = this;
    return new THREE.TextureLoader().load(url, function() {
      self._draw();
    });
  };
  ThreeView.prototype._glowTexture = function() {
    if (!this.textureCache.shadowGlow) {
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      var ctx = canvas.getContext('2d');
      var gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,.75)');
      gradient.addColorStop(.5, 'rgba(255,255,255,.32)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      this.textureCache.shadowGlow = new THREE.CanvasTexture(canvas);
    }
    return this.textureCache.shadowGlow;
  };
  ThreeView.prototype._pieceTexture = function(color, kind) {
    var key = color + kind;
    if (!this.textureCache[key]) {
      var tex = this._loadTexture('assets/pieces/' + color + '/' + kind + '.webp');
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textureCache[key] = tex;
    }
    return this.textureCache[key];
  };
  ThreeView.prototype._realmTexture = function(realm) {
    var key = 'surface-' + realm;
    if (!this.textureCache[key]) {
      var tex = this._loadTexture('assets/materials/' + realm + '.webp');
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textureCache[key] = tex;
    }
    return this.textureCache[key];
  };
  ThreeView.prototype.resize = function() {
    if (!this.renderer || !this.camera) return;
    var rect = this.container.getBoundingClientRect(),
      w = Math.max(1, rect.width),
      h = Math.max(1, rect.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._placeCamera();
    if (this.active) this.renderer.render(this.scene, this.camera);
  };
  ThreeView.prototype.render = function(chess, themeId, legalSquares, selectedSquare, lastMove) {
    if (!this.scene) return;
    var theme = THEMES[themeId] || THEMES.highlands;
    this._setTheme(theme);
    this.orbitTarget.x = this.orbit.x; // Unfinished drags keep their azimuth target.
    legalSquares = legalSquares || [];
    var legal = {};
    legalSquares.forEach(function(x) {
      legal[typeof x === 'string' ? x : (x.to || x.square)] = true;
    });
    this.squares.forEach(function(s) {
      s.material.color.setHex(s.userData.baseColor);
      s.material.opacity = .28;
      if (legal[s.userData.square]) {
        s.material.color.lerp(new THREE.Color(0x64d985), .55);
        s.material.opacity = .78;
      }
      if (lastMove && (lastMove.from === s.userData.square || lastMove.to === s.userData.square)) {
        s.material.color.lerp(new THREE.Color(0xf4d255), .58);
        s.material.opacity = .55;
      }
      if (selectedSquare === s.userData.square) {
        s.material.color.set(0xffb834);
        s.material.opacity = .92;
      }
    });
    var nextPosition = chess && typeof chess.fen === 'function' ? chess.fen() : null;
    if (nextPosition && this.positionKey === nextPosition && this.pieces.length) {
      this._updateFocus();
      this._draw();
      return;
    }
    var previousPosition = this.positionKey;
    this.motion.cancel();
    while (this.pieces.length) {
      var p = this.pieces.pop();
      this.boardRoot.remove(p);
      p.traverse(function(o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(function(m) {
            m.dispose();
          });
          else o.material.dispose();
        }
      });
    }
    var board = chess && typeof chess.board === 'function' ? chess.board() : [];
    var self = this;
    for (var ri = 0; ri < board.length; ri++)
      for (var fi = 0; fi < (board[ri] || []).length; fi++) {
        var piece = board[ri][fi];
        if (!piece) continue;
        var x = fi - 3.5,
          z = ri - 3.5,
          grp = new THREE.Group();
        grp.position.set(x, -.39, z);
        this.boardRoot.add(grp);
        this.pieces.push(grp);
        var dawn = piece.color === 'w',
          base = new THREE.Mesh(new THREE.RingGeometry(.26, .32, 32), new THREE.MeshBasicMaterial({
            color: dawn ? 0xf1d9a0 : 0xae7ce3,
            transparent: true,
            opacity: .78,
            side: THREE.DoubleSide,
            depthWrite: false
          }));
        base.rotation.x = -Math.PI / 2;
        base.position.y = .025;
        grp.add(base);
        var shadow = new THREE.Mesh(new THREE.CircleGeometry(.27, 24), new THREE.MeshBasicMaterial({
          color: 0x0a1018, transparent: true, opacity: .38,
          side: THREE.DoubleSide, depthWrite: false
        }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = .012;
        grp.add(shadow);
        var kind = PIECES[piece.type],
          tex = this._pieceTexture(dawn ? 'dawn' : 'shadow', kind);
        var glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this._glowTexture(), color: dawn ? 0xffd98c : 0xc487f4,
          transparent: true, opacity: dawn ? .6 : .72, depthWrite: false
        }));
        glow.position.y = .69;
        glow.scale.set(1.42, 1.54, 1);
        glow.renderOrder = 1;
        grp.add(glow);
        var plane = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false
        }));
        plane.position.y = .69;
        plane.rotation.y = this.orbit.x;
        plane.renderOrder = 2;
        plane.userData.billboard = true;
        grp.add(plane);
        if (piece.type === 'k' && chess.turn() === piece.color && ((typeof chess.in_check === 'function' && chess.in_check()) || (typeof chess.isCheck === 'function' && chess.isCheck()))) base.material.color.set(0xd74232);
      }
    this.positionKey = nextPosition;
    if (previousPosition && nextPosition && previousPosition !== nextPosition &&
        this.active && !this._reduced && lastMove && lastMove.from && lastMove.to) {
      var toX = lastMove.to.charCodeAt(0) - 97 - 3.5;
      var toZ = 3.5 - (+lastMove.to[1] - 1);
      var moved = this.pieces.find(function(group) {
        return group.position.x === toX && group.position.z === toZ;
      });
      if (moved) {
        var origin = new THREE.Vector3(lastMove.from.charCodeAt(0) - 97 - 3.5,
          -.39, 3.5 - (+lastMove.from[1] - 1));
        this.motion.begin(moved, origin, moved.position, performance.now());
      }
    }
    this._updateFocus();
    this._draw();
  };
  ThreeView.prototype._clearTerrain = function() {
    var self = this;
    this.terrainFeatures.forEach(function(o) {
      self.boardRoot.remove(o);
      o.traverse(function(n) {
        if (n.geometry) n.geometry.dispose();
        if (n.material) {
          var ms = Array.isArray(n.material) ? n.material : [n.material];
          ms.forEach(function(m) {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    });
    this.terrainFeatures = [];
  };
  ThreeView.prototype._setTheme = function(t) {
    if (this.themeSignature === t.signature) return;
    this.themeSignature = t.signature;
    this._clearTerrain();
    this.hemiLight.color.setHex(t.light);
    this.sunLight.color.setHex(t.light);
    var surface = this._realmTexture(t.asset);
    this.squares.forEach(function(s) {
      var f = s.userData.square.charCodeAt(0) - 97,
        r = +s.userData.square[1] - 1;
      s.userData.baseColor = ((f + r) & 1) ? t.tiles[1] : t.tiles[0];
      s.material.map = surface;
      s.material.color.setHex(s.userData.baseColor);
      s.material.needsUpdate = true;
    });
    var terrainTexture = this._loadTexture('assets/materials/' + t.asset + '.webp');
    terrainTexture.colorSpace = THREE.SRGBColorSpace;
    terrainTexture.wrapS = terrainTexture.wrapT = THREE.RepeatWrapping;
    terrainTexture.repeat.set(1, 1); // UVs already scale the texture across the world.
    this.terrainFeatures = root.FantasyChess.TerrainWorlds.build(this.boardRoot, this.scene, t.asset, terrainTexture);
    if (t.camera) {
      // Each realm frames its own war perspective; the camera glides there.
      var aspectPull = Math.max(1, 1.45 / this.camera.aspect);
      this.orbitTarget.x = t.camera.x;
      this.orbitTarget.y = t.camera.y;
      this.orbitTarget.distance = t.camera.distance * aspectPull;
      this.lookAtTarget.set(t.camera.lookAt[0], t.camera.lookAt[1], t.camera.lookAt[2]);
    }
  };
  ThreeView.prototype._draw = function() {
    if (!this.renderer || !this.scene) return;
    this.renderer.render(this.scene, this.camera);
  };
  ThreeView.prototype.setActive = function(value) {
    this.active = !!value;
    if (!this.active) {
      this.motion.cancel();
      if (this.frame) root.cancelAnimationFrame(this.frame);
      this.frame = 0;
      this._draw();
      return;
    }
    if (this.frame || this._reduced) return;
    var self = this;
    this.clock = this.clock || new THREE.Clock();
    var tick = function() {
      if (!self.active) return;
      root.FantasyChess.TerrainWorlds.animate(self.terrainFeatures, self.clock.getElapsedTime());
      self.motion.update(performance.now());
      self.updateCamera(self.clock.getDelta() || 1 / 60);
      self._draw();
      self.frame = root.requestAnimationFrame(tick);
    };
    tick();
  };
  ThreeView.prototype.destroy = function() {
    this.setActive(false);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this._listeners.forEach(function(l) {
      l[0].removeEventListener(l[1], l[2], l[3]);
    });
    this._listeners = [];
    this._clearTerrain();
    if (this.scene && this.scene.background && this.scene.background.isTexture) this.scene.background.dispose();
    Object.keys(this.textureCache).forEach(function(key) {
      this.textureCache[key].dispose();
    }, this);
    this.textureCache = {};
    while (this.pieces.length) {
      var p = this.pieces.pop();
      this.boardRoot.remove(p);
      p.traverse(function(o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(function(m) {
            m.dispose();
          });
          else o.material.dispose();
        }
      });
    }
    if (this.scene) {
      this.scene.traverse(function(o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(function(m) {
            m.dispose();
          });
          else o.material.dispose();
        }
      });
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    if (this.statusElement && this.statusElement.parentNode) this.statusElement.parentNode.removeChild(this.statusElement);
    this.renderer = this.scene = this.camera = null;
    this.squares = [];
  };
  root.FantasyChess = root.FantasyChess || {};
  root.FantasyChess.ThreeView = ThreeView;
}(window));