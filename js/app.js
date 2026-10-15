(function startFantasyChess() {
  "use strict";

  const namespace = window.FantasyChess;
  const game = new namespace.Game();
  const flow = new namespace.MatchFlow();
  const battlefield = document.getElementById("battlefield");
  const sidebar = document.getElementById("settings-panel");
  const promotionDialog = document.getElementById("promotion");
  const endDialog = document.getElementById("confirm-end");
  const settingsToggle = document.getElementById("settings-toggle");
  const startButton = document.getElementById("start-battle");
  const endButton = document.getElementById("end-battle");
  const outcome = document.getElementById("outcome");
  const chroniclePanel = document.getElementById("chronicle");
  const chronicleToggle = document.getElementById("chronicle-toggle");
  let chronicleOpen = false;
  let pendingPromotion = null;
  let endedByForfeit = false;
  let viewMode = null;

  const board = new namespace.Board(document.getElementById("board"), game, {
    canInteract: () => flow.phase === "active" && !chronicle.active,
    onMove: (move) => {
      chronicle.reset();
      render();
      effects.play(move);
      requestOpponentMove();
    },
    onPromotion: (from, to) => {
      pendingPromotion = { from, to };
      promotionDialog.returnValue = "";
      promotionDialog.showModal();
    },
  });

  const controls = new namespace.Controls({
    difficulty: document.getElementById("difficulty"),
    note: document.getElementById("difficulty-note"),
    status: document.getElementById("status"),
    last: document.getElementById("last"),
    history: document.getElementById("history"),
    empty: document.getElementById("history-empty"),
  }, {});
  const themes = new namespace.Themes(document.getElementById("themes"), document.body, () => {
    if (viewMode?.active) renderThree();
  });
  const effects = new namespace.BattleEffects(board.element);
  const fullscreen = new namespace.Fullscreen(battlefield, document.getElementById("fullscreen"));
  const chronicle = new namespace.Chronicle({
    undo: document.getElementById("undo-turn"),
    redo: document.getElementById("redo-turn"),
    back: document.getElementById("history-back"),
    next: document.getElementById("history-next"),
    live: document.getElementById("history-live"),
    moves: document.getElementById("move-timeline"),
    notice: document.getElementById("preview-notice"),
  }, { onUndo: undoTurn, onRedo: redoTurn, onChange: render });
  viewMode = new namespace.ViewMode({
    button: document.getElementById("view-mode"),
    board2d: board.element,
    board3d: document.getElementById("board-3d"),
    frame: document.querySelector(".board-frame"),
  }, () => new namespace.ThreeView(document.getElementById("board-3d"), {
    onSquare: (square) => {
      board.click(square);
      renderThree(); // Selecting a soldier changes legal highlights without a move.
    },
  }), {
    onChange: (mode) => {
      document.body.dataset.view = mode;
      if (mode === "3d") chronicleOpen = false;
      render();
      if (mode === "3d") viewMode.view.renderer.domElement.focus();
      else board.element.querySelector(`[data-square="${board.focused}"]`)?.focus();
    },
    onError: () => { controls.elements.status.textContent = "3D غير متاح هنا؛ عُدنا إلى الرقعة العادية"; },
  });

  function renderThree() {
    if (!viewMode.active) return;
    const chess = chronicle.active ? game.positionAt(chronicle.ply) : game.chess;
    viewMode.render(chess, themes.selected, chronicle.active ? [] : board.targets,
      chronicle.active ? null : board.selected, chess.history({ verbose: true }).at(-1));
  }

  function renderShell() {
    document.body.dataset.phase = flow.phase;
    battlefield.dataset.phase = flow.phase;
    sidebar.hidden = !flow.settingsOpen;
    settingsToggle.hidden = flow.phase === "active";
    settingsToggle.textContent = flow.settingsOpen ? "إخفاء الإعدادات" : "إظهار الإعدادات";
    settingsToggle.setAttribute("aria-expanded", String(flow.settingsOpen));
    fullscreen.button.hidden = flow.phase === "active";
    endButton.hidden = flow.phase !== "active";
    startButton.hidden = flow.phase === "active";
    startButton.firstChild.textContent = flow.phase === "finished" ? "معركة جديدة " : "ابدأ المعركة ";
    outcome.hidden = flow.phase !== "finished";
    chroniclePanel.hidden = flow.phase === "menu" || game.chess.history().length === 0;
    const canOpenChronicle = flow.phase === "active" && viewMode?.active && !chroniclePanel.hidden;
    chronicleToggle.hidden = !canOpenChronicle;
    battlefield.dataset.chronicleOpen = String(canOpenChronicle && chronicleOpen);
    chronicleToggle.setAttribute("aria-expanded", String(canOpenChronicle && chronicleOpen));
    chronicleToggle.textContent = chronicleOpen && canOpenChronicle ? "إغلاق السجل" : "السجل";
    board.element.classList.toggle("is-replay", chronicle.active);
    board.element.setAttribute("aria-label", chronicle.active
      ? `معاينة سابقة بعد النقلة ${chronicle.ply}، لا يمكن تحريك القطع`
      : "رقعة الشطرنج، الفجر ضد الظل");

    if (flow.phase === "menu") {
      controls.elements.status.textContent = "اختر عالمك ثم ابدأ";
      controls.elements.last.textContent = "اختر عالمك وقوة الخصم، ثم ابدأ المعركة.";
    }
    if (flow.phase === "finished") {
      const titles = {
        victory: "انتصرت مملكة الفجر",
        defeat: "سقطت مملكة الفجر",
        draw: "انتهت المعركة بالتعادل",
      };
      const labels = { victory: "نصر", defeat: "هزيمة", draw: "تعادل" };
      document.getElementById("outcome-kicker").textContent = labels[flow.result];
      document.getElementById("outcome-title").textContent = titles[flow.result];
      document.getElementById("outcome-detail").textContent = endedByForfeit
        ? "انسحبت من المعركة. يمكنك اختيار عالم وتحدٍ جديدين."
        : "انتهت المباراة. اختر عالمك وقوة الخصم، ثم ابدأ معركة جديدة.";
      controls.elements.status.textContent = titles[flow.result];
    }
    if (chronicle.active && flow.phase === "active") {
      controls.elements.status.textContent = "استعراض سابق — عُد للمباشر للعب";
    }
  }

  function render() {
    if (flow.sync(game.chess)) effects.clear();
    chronicle.render(game, flow.phase);
    board.render(chronicle.active ? game.positionAt(chronicle.ply) : game.chess);
    controls.render(game);
    renderShell();
    renderThree();
  }

  function requestOpponentMove() {
    if (flow.phase !== "active" || game.chess.turn() !== "b" || game.chess.game_over()) return;
    game.requestAI(controls.level, (move) => {
      render();
      effects.play(move, !chronicle.active);
    });
    render();
  }

  function dismissPromotion() {
    pendingPromotion = null;
    if (promotionDialog.open) promotionDialog.close("");
  }

  function startBattle() {
    if (!flow.start()) return;
    endedByForfeit = false;
    dismissPromotion();
    effects.clear();
    game.reset();
    chronicle.reset();
    chronicleOpen = false;
    board.clearSelection();
    render();
    board.element.querySelector('[data-square="e2"]')?.focus();
  }

  function undoTurn() {
    if (flow.phase !== "active" || chronicle.active) return;
    dismissPromotion();
    if (!game.undo()) return;
    effects.clear();
    board.clearSelection();
    render();
  }

  function redoTurn() {
    if (flow.phase !== "active" || chronicle.active || !game.redo()) return;
    effects.clear();
    board.clearSelection();
    render();
    requestOpponentMove();
  }

  function forfeitBattle() {
    endDialog.close();
    if (flow.phase !== "active") return;
    game.cancelAI();
    chronicle.reset();
    dismissPromotion();
    effects.clear();
    endedByForfeit = true;
    flow.finish("defeat");
    render();
    startButton.focus();
  }

  function downloadPgn() {
    if (!game.chess.history().length) return;
    const url = URL.createObjectURL(new Blob([game.exportPgn(flow.result)],
      { type: "application/x-chess-pgn;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "fantasy-chess.pgn";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  startButton.addEventListener("click", startBattle);
  chronicleToggle.addEventListener("click", () => {
    if (chronicleToggle.hidden) return;
    chronicleOpen = !chronicleOpen;
    renderShell();
  });
  document.getElementById("export-pgn").addEventListener("click", downloadPgn);
  settingsToggle.addEventListener("click", () => {
    flow.toggleSettings();
    renderShell();
  });
  endButton.addEventListener("click", () => endDialog.showModal());
  document.getElementById("keep-playing").addEventListener("click", () => endDialog.close());
  document.getElementById("confirm-forfeit").addEventListener("click", forfeitBattle);
  document.getElementById("cancel-promotion").addEventListener("click", () => {
    dismissPromotion();
    board.clearSelection();
  });
  promotionDialog.addEventListener("cancel", () => {
    pendingPromotion = null;
    board.clearSelection();
  });
  document.querySelector(".promotion-choices").addEventListener("click", (event) => {
    const choice = event.target.closest("button[value]")?.value;
    if (!choice || !pendingPromotion) return;
    const move = pendingPromotion;
    pendingPromotion = null;
    promotionDialog.close("");
    board.move(move.from, move.to, choice);
  });
  promotionDialog.addEventListener("close", () => { pendingPromotion = null; });

  render();
  namespace.app = { game, board, flow, controls, themes, effects, fullscreen, chronicle, viewMode, render };
})();
