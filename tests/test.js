(() => {
  "use strict";

  let passed = 0;
  let failed = 0;
  const cases = document.getElementById("cases");

  function assert(condition, message) {
    if (!condition) throw new Error(message || "Assertion failed");
  }

  function test(name, run) {
    const item = document.createElement("li");
    try {
      run();
      passed += 1;
      item.textContent = `PASS ${name}`;
      item.style.color = "green";
    } catch (error) {
      failed += 1;
      item.textContent = `FAIL ${name}: ${error.message}`;
      item.style.color = "red";
    }
    cases.append(item);
  }

  test("initial position has twenty legal moves", () => {
    assert(new Chess().moves().length === 20);
  });

  test("an illegal move is rejected", () => {
    assert(new Chess().move({ from: "e2", to: "e5" }) === null);
  });

  test("castling moves the rook", () => {
    const chess = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    assert(chess.move("O-O") && chess.get("f1").type === "r");
  });

  test("en passant is legal", () => {
    const chess = new Chess();
    ["e4", "a6", "e5", "d5"].forEach((move) => chess.move(move));
    assert(chess.move("exd6").flags.includes("e"));
  });

  test("all four promotion choices are legal", () => {
    for (const promotion of ["q", "r", "b", "n"]) {
      const chess = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
      assert(chess.move({ from: "a7", to: "a8", promotion }).promotion === promotion);
    }
  });

  test("fool's mate ends in checkmate", () => {
    const chess = new Chess();
    ["f3", "e5", "g4", "Qh4#"].forEach((move) => chess.move(move));
    assert(chess.game_over() && chess.in_check());
  });

  test("stalemate ends without check", () => {
    const chess = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    assert(chess.game_over() && !chess.in_check());
  });

  test("all three AI levels return a legal move", () => {
    for (const level of ["easy", "medium", "hard"]) {
      const chess = new Chess();
      const before = chess.fen();
      const move = FantasyChess.AI.choose(chess, level, () => 0);
      assert(move && chess.moves({ verbose: true }).some(
        (legal) => legal.from === move.from && legal.to === move.to,
      ));
      assert(chess.fen() === before, `AI ${level} changed the live board while searching`);
    }
  });

  test("hard AI prioritizes a forced mate over a quiet move", () => {
    const chess = new Chess();
    ["f3", "e5", "g4"].forEach((move) => chess.move(move));
    const choice = FantasyChess.AI.choose(chess, "hard", () => 0);
    assert(choice?.san === "Qh4#", `Expected Qh4#, got ${choice?.san}`);
  });

  test("hard AI contests the centre in a quiet opening", () => {
    const chess = new Chess();
    chess.move("e4");
    for (const seed of [0, 0.99]) {
      const choice = FantasyChess.AI.choose(chess, "hard", () => seed);
      assert(["d5", "e5", "Nf6", "Nc6"].includes(choice?.san),
        `Expected an active opening reply for seed ${seed}, got ${choice?.san}`);
    }
  });

  test("undo cancels a queued AI turn", () => {
    const game = new FantasyChess.Game();
    game.play("e2", "e4");
    game.requestAI("easy", () => {
      throw new Error("An invalidated AI response ran");
    });
    game.undo();
    assert(game.chess.history().length === 0 && !game.pending);
  });

  test("undo and redo restore the exact same full turn", () => {
    const game = new FantasyChess.Game();
    game.play("e2", "e4");
    game.chess.move("c5");
    const original = game.chess.fen();
    assert(game.undo() && game.chess.history().length === 0);
    assert(game.redo() && game.chess.fen() === original);
  });

  test("a new branch discards redo without changing the legal board", () => {
    const game = new FantasyChess.Game();
    game.play("e2", "e4");
    game.chess.move("e5");
    game.undo();
    assert(game.redoTurns.length === 1);
    game.play("d2", "d4");
    assert(!game.redo() && game.chess.history()[0] === "d4");
  });

  test("redo of a pending white move restores it for one AI reply", () => {
    const game = new FantasyChess.Game();
    game.play("e2", "e4");
    game.requestAI("easy");
    assert(game.undo());
    assert(game.redo() && game.chess.turn() === "b" && game.chess.history().length === 1);
    assert(game.requestAI("easy") && !game.requestAI("easy"));
    game.cancelAI();
  });

  test("past positions can be inspected without rewinding the live game", () => {
    const game = new FantasyChess.Game();
    const initial = game.chess.fen();
    game.play("e2", "e4");
    game.chess.move("e5");
    const live = game.chess.fen();
    const first = game.positionAt(1);
    assert(game.positionAt(0).fen() === initial);
    assert(first.get("e4")?.type === "p" && first.get("e5") === null);
    assert(game.positionAt(2).fen() === live && game.chess.fen() === live);
    assert(game.positionAt(-1) === null && game.positionAt(3) === null);
  });

  test("PGN export preserves the game and records the match result", () => {
    const game = new FantasyChess.Game();
    game.play("e2", "e4");
    game.chess.move("e5");
    const before = game.chess.fen();
    const notation = game.exportPgn("draw");
    assert(notation.includes("1. e4 e5") && notation.includes('[Result "1/2-1/2"]'));
    assert(game.chess.fen() === before);
  });

  test("the player cannot make a move for the AI", () => {
    const game = new FantasyChess.Game();
    assert(game.play("e2", "e4"), "White's first move should be legal");
    assert(game.play("e7", "e5") === null, "Black must belong to the AI");
    assert(game.chess.history().length === 1);
  });

  test("re-rendering after keyboard selection keeps board focus", () => {
    const element = document.getElementById("board");
    const board = new FantasyChess.Board(element, new FantasyChess.Game(), () => {});
    element.querySelector('[data-square="e2"]').focus();
    board.click("e2");
    assert(document.activeElement?.dataset.square === "e2", "Focus left the selected square");
  });

  test("the board cannot move before battle begins", () => {
    const element = document.getElementById("board");
    const game = new FantasyChess.Game();
    const board = new FantasyChess.Board(element, game, { canInteract: () => false });
    board.click("e2");
    board.click("e4");
    assert(board.selected === null && game.chess.history().length === 0);
  });

  test("board shows an old position without changing the live position", () => {
    const element = document.getElementById("board");
    const game = new FantasyChess.Game();
    game.play("e2", "e4");
    game.chess.move("e5");
    const before = game.chess.fen();
    const board = new FantasyChess.Board(element, game, { canInteract: () => false });
    board.render(game.positionAt(0));
    assert(element.querySelector('[data-square="e2"] .piece.white'));
    assert(!element.querySelector('[data-square="e4"] .piece'));
    assert(game.chess.fen() === before && game.chess.history().length === 2);
  });

  test("fantasy armies render as local, distinct miniature images", () => {
    new FantasyChess.Board(document.getElementById("board"), new FantasyChess.Game(), () => {});
    const images = [...document.querySelectorAll("#board img.piece")];
    assert(images.length === 32, "Expected 32 illustrated miniatures");
    assert(images.some((image) => image.src.endsWith("/assets/pieces/dawn/king.webp")));
    assert(images.some((image) => image.src.endsWith("/assets/pieces/shadow/king.webp")));
    assert(images.every((image) => image.src.includes("/assets/pieces/")));
  });

  test("each piece fits within its own board square", () => {
    new FantasyChess.Board(document.getElementById("board"), new FantasyChess.Game(), () => {});
    const squares = [...document.querySelectorAll("#board .square")];
    assert(squares.length === 64, "Expected 64 square buttons");
    for (const square of squares) {
      const piece = square.querySelector(".piece");
      if (!piece) continue;
      const cell = square.getBoundingClientRect();
      const icon = piece.getBoundingClientRect();
      assert(icon.width <= cell.width && icon.height <= cell.height && icon.height >= cell.height * 0.85,
        `Miniature does not fill its tile without spilling: ${square.dataset.square}`);
    }
  });

  test("theme cards switch the illustration and remain single-select", () => {
    const container = document.createElement("div");
    const page = document.createElement("div");
    document.body.append(container);
    const picker = new FantasyChess.Themes(container, page);
    assert(container.querySelectorAll("button").length === 5, "Expected all five realms");
    picker.select("glacier");
    assert(page.dataset.theme === "glacier", "The palette did not change");
    assert(container.querySelectorAll('[aria-pressed="true"]').length === 1);
    assert(container.querySelector('[data-theme-choice="glacier"] img').getAttribute("src").endsWith("/glacier.webp"));
    container.remove();
  });

  test("changing the realm notifies the 3D view without touching chess rules", () => {
    const container = document.createElement("div");
    const page = document.createElement("div");
    const game = new FantasyChess.Game();
    let selected = null;
    const picker = new FantasyChess.Themes(container, page, (id) => { selected = id; });
    picker.select("volcano");
    assert(selected === "volcano" && game.chess.history().length === 0);
  });

  test("difficulty controls use three levels with one active choice", () => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `<div class="levels"><button data-difficulty="easy"></button>
      <button data-difficulty="medium"></button><button data-difficulty="hard"></button></div>
      <p class="note"></p><p class="status"></p><p class="last"></p>
      <ol class="history"></ol><p class="empty"></p>
      <button class="new"></button><button class="undo"></button>`;
    document.body.append(fixture);
    const get = (selector) => fixture.querySelector(selector);
    const controls = new FantasyChess.Controls({
      difficulty: get(".levels"), note: get(".note"), status: get(".status"),
      last: get(".last"), history: get(".history"), empty: get(".empty"),
      newGame: get(".new"), undo: get(".undo"),
    }, { onNew() {}, onUndo() {} });
    get('[data-difficulty="hard"]').click();
    assert(controls.level === "hard");
    assert(fixture.querySelectorAll('[aria-pressed="true"]').length === 1);
    assert(get(".note").textContent.includes("عدة نقلات"));
    fixture.remove();
  });

  test("rendered move history and reset controls match the real game state", () => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `<div class="levels"></div><p class="note"></p>
      <p class="status"></p><p class="last"></p><ol class="history"></ol>
      <p class="empty"></p><button class="new"></button><button class="undo"></button>`;
    document.body.append(fixture);
    const get = (selector) => fixture.querySelector(selector);
    const game = new FantasyChess.Game();
    const controls = new FantasyChess.Controls({
      difficulty: get(".levels"), note: get(".note"), status: get(".status"),
      last: get(".last"), history: get(".history"), empty: get(".empty"),
      newGame: get(".new"), undo: get(".undo"),
    }, { onNew() {}, onUndo() {} });
    controls.render(game);
    assert(get(".undo").disabled && !get(".empty").hidden);
    game.play("e2", "e4");
    controls.render(game);
    assert(get(".history li").textContent.includes("e4"));
    assert(!get(".undo").disabled && get(".empty").hidden);
    game.undo();
    controls.render(game);
    assert(get(".history").children.length === 0 && get(".undo").disabled);
    fixture.remove();
  });

  test("controls do not require in-battle restart or undo buttons", () => {
    const fixture = document.createElement("div");
    fixture.innerHTML = '<div class="levels"></div><p class="note"></p><p class="status"></p><p class="last"></p><ol class="history"></ol><p class="empty"></p>';
    const get = (selector) => fixture.querySelector(selector);
    const controls = new FantasyChess.Controls({
      difficulty: get(".levels"), note: get(".note"), status: get(".status"),
      last: get(".last"), history: get(".history"), empty: get(".empty"),
    }, {});
    controls.render(new FantasyChess.Game());
    assert(get(".status").textContent.includes("الأبيض"));
  });

  test("chronicle previews move positions without editing the match", () => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `<button class="undo"></button><button class="redo"></button>
      <button class="back"></button><button class="next"></button><button class="live"></button>
      <div class="moves"></div><p class="notice"></p>`;
    const query = (s) => fixture.querySelector(s);
    const game = new FantasyChess.Game();
    game.play("e2", "e4");
    game.chess.move("e5");
    const before = game.chess.fen();
    const chronicle = new FantasyChess.Chronicle({
      undo: query(".undo"), redo: query(".redo"), back: query(".back"),
      next: query(".next"), live: query(".live"), moves: query(".moves"), notice: query(".notice"),
    }, { onChange() {} });
    chronicle.render(game, "active");
    query(".back").click();
    assert(chronicle.ply === 1 && game.chess.fen() === before);
    assert(query(".undo").disabled, "Review mode must be read-only");
    query(".back").click();
    assert(chronicle.ply === 0 && game.positionAt(0).history().length === 0);
    query(".next").click();
    assert(chronicle.ply === 1);
    query(".live").click();
    assert(chronicle.ply === null && game.chess.fen() === before);
  });

  test("keyboard focus stays on the selected move while reviewing", () => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `<button class="undo"></button><button class="redo"></button>
      <button class="back"></button><button class="next"></button><button class="live"></button>
      <div class="moves"></div><p class="notice"></p>`;
    document.body.append(fixture);
    const el = (selector) => fixture.querySelector(selector);
    const game = new FantasyChess.Game();
    game.play("e2", "e4");
    game.chess.move("e5");
    const chronicle = new FantasyChess.Chronicle({
      undo: el(".undo"), redo: el(".redo"), back: el(".back"), next: el(".next"),
      live: el(".live"), moves: el(".moves"), notice: el(".notice"),
    });
    chronicle.render(game, "active");
    el('[data-ply="1"]').focus();
    el('[data-ply="1"]').click();
    assert(document.activeElement?.dataset.ply === "1");
    fixture.remove();
  });

  test("active battle hides the decorative outer side panels", () => {
    const arena = document.createElement("div");
    arena.className = "game-layout";
    arena.dataset.phase = "active";
    arena.innerHTML = '<div class="terrain terrain-left"></div><div class="terrain terrain-right"></div>';
    document.body.append(arena);
    const hidden = [...arena.querySelectorAll(".terrain")].every((item) => getComputedStyle(item).display === "none");
    arena.remove();
    assert(hidden);
  });

  test("active 3D battle fills the viewport without a framed board", () => {
    const fixture = document.createElement("main");
    fixture.className = "game-layout";
    fixture.dataset.phase = "active";
    fixture.innerHTML = '<section class="arena"><header class="arena-heading"></header><div class="board-frame is-three"><div class="three-stage"></div></div><section id="chronicle" class="chronicle"></section></section>';
    document.body.dataset.phase = "active";
    document.body.dataset.view = "3d";
    document.body.append(fixture);
    const frame = fixture.querySelector(".board-frame");
    const stage = fixture.querySelector(".three-stage");
    const full = getComputedStyle(fixture).position === "fixed" &&
      fixture.getBoundingClientRect().width === innerWidth &&
      fixture.getBoundingClientRect().height === innerHeight &&
      getComputedStyle(frame).boxShadow === "none" &&
      stage.getBoundingClientRect().height === innerHeight;
    fixture.remove();
    delete document.body.dataset.phase;
    delete document.body.dataset.view;
    assert(full, "3D battle must be a full-viewport world, not a framed square");
  });

  test("battlefield chronicle stays folded until summoned", () => {
    const fixture = document.createElement("main");
    fixture.className = "game-layout";
    fixture.dataset.phase = "active";
    fixture.dataset.chronicleOpen = "false";
    fixture.innerHTML = '<section class="arena"><section class="chronicle">سجل النقلات</section></section>';
    document.body.dataset.phase = "active";
    document.body.dataset.view = "3d";
    document.body.append(fixture);
    const panel = fixture.querySelector(".chronicle");
    const folded = getComputedStyle(panel).display === "none";
    fixture.dataset.chronicleOpen = "true";
    const opened = getComputedStyle(panel).display !== "none";
    fixture.remove();
    delete document.body.dataset.phase;
    delete document.body.dataset.view;
    assert(folded && opened, "war HUD should not cover the field without a request");
  });

  test("3D stage carries no photo backdrop behind the WebGL world", () => {
    const stage = document.createElement("div");
    stage.className = "three-stage";
    document.body.dataset.theme = "volcano";
    document.body.append(stage);
    const background = getComputedStyle(stage).backgroundImage;
    stage.remove();
    delete document.body.dataset.theme;
    assert(!background.includes("3d-panoramas"), "the 3D sky must come from WebGL, not a photo");
  });

  test("3D switch toggles real 3D stage without changing the game", () => {
    const fixture = document.createElement("div");
    fixture.innerHTML = '<button class="toggle" hidden>3D</button><div class="frame"><div class="flat"></div><div class="spatial" hidden></div></div>';
    document.body.append(fixture);
    const el = (selector) => fixture.querySelector(selector);
    const game = new FantasyChess.Game();
    const original = game.chess.fen();
    const calls = [];
    const mode = new FantasyChess.ViewMode({
      button: el(".toggle"), board2d: el(".flat"), board3d: el(".spatial"), frame: el(".frame"),
    }, () => ({ init: () => true, setActive: (active) => calls.push(active), resize() {}, destroy() {} }));
    assert(!el(".toggle").hidden && mode.toggle());
    assert(mode.mode === "3d" && el(".flat").hidden && !el(".spatial").hidden);
    assert(el(".toggle").getAttribute("aria-pressed") === "true");
    assert(mode.toggle() && mode.mode === "2d" && !el(".flat").hidden && el(".spatial").hidden);
    assert(game.chess.fen() === original && calls.join(",") === "true,false");
    fixture.remove();
  });

  test("3D render resizes canvas after the battle layout expands", () => {
    const fixture = document.createElement("div");
    fixture.innerHTML = '<button class="toggle"></button><div class="frame"><div class="flat"></div><div class="spatial" hidden></div></div>';
    document.body.append(fixture);
    let resizes = 0;
    const mode = new FantasyChess.ViewMode({
      button: fixture.querySelector(".toggle"), board2d: fixture.querySelector(".flat"),
      board3d: fixture.querySelector(".spatial"), frame: fixture.querySelector(".frame"),
    }, () => ({ init: () => true, setActive() {}, resize: () => { resizes++; }, render() {}, destroy() {} }));
    mode.toggle();
    mode.render(new Chess(), "volcano");
    assert(resizes === 2, "switch and subsequent render should both size the 3D canvas");
    fixture.remove();
  });

  test("immersive view toggles without the Fullscreen API", () => {
    const target = document.createElement("div");
    const button = document.createElement("button");
    target.append(button);
    document.body.append(target);
    Object.defineProperty(target, "requestFullscreen", { value: undefined });
    new FantasyChess.Fullscreen(target, button);
    button.click();
    assert(target.classList.contains("is-immersive") && button.getAttribute("aria-pressed") === "true");
    button.click();
    assert(!target.classList.contains("is-immersive") && button.getAttribute("aria-pressed") === "false");
    target.remove();
  });

  test("battle lifecycle hides settings until the result", () => {
    const flow = new FantasyChess.MatchFlow();
    assert(flow.phase === "menu" && flow.settingsOpen);
    flow.start();
    assert(flow.phase === "active" && !flow.settingsOpen);
    assert(flow.toggleSettings() === false, "Settings must stay closed during battle");
    flow.finish("defeat");
    assert(flow.phase === "finished" && flow.settingsOpen && flow.result === "defeat");
    flow.start();
    assert(flow.phase === "active" && flow.result === null);
  });

  test("chess results distinguish victory, defeat and draw", () => {
    const positions = [
      ["7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", "victory"],
      ["rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", "defeat"],
      ["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "draw"],
    ];
    for (const [fen, expected] of positions) {
      const flow = new FantasyChess.MatchFlow();
      flow.start();
      assert(flow.sync(new Chess(fen)) && flow.result === expected, `${expected} not recognized`);
      assert(flow.phase === "finished" && flow.settingsOpen);
    }
  });

  test("battle effects expose move and capture hooks without changing chess", () => {
    const board = document.createElement("div");
    board.innerHTML = '<button data-square="e4"></button>';
    const square = board.firstElementChild;
    let event = null;
    board.addEventListener("fantasy:move", (signal) => { event = signal.detail; });
    const effects = new FantasyChess.BattleEffects(board);
    effects.play({ from: "e2", to: "e4", san: "e4", color: "w" });
    assert(event?.to === "e4" && event?.san === "e4" && !event?.capture);
    assert(square.classList.contains("effect-move"));
    effects.clear();
    assert(!square.classList.contains("effect-move"));
  });

  test("AI move events still fire without flashing a historical preview", () => {
    const board = document.createElement("div");
    board.innerHTML = '<button data-square="e5"></button>';
    let heard = null;
    board.addEventListener("fantasy:move", (event) => { heard = event.detail; });
    new FantasyChess.BattleEffects(board).play({ from: "e7", to: "e5", san: "e5", color: "b" }, false);
    assert(heard?.to === "e5" && !board.firstElementChild.classList.contains("effect-move"));
  });

  document.getElementById("result").textContent = `${passed} passed, ${failed} failed`;
  document.body.dataset.result = failed ? "fail" : "pass";
})();
