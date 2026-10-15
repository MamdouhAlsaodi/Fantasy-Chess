window.FantasyChess = window.FantasyChess || {};

(function registerControls(namespace) {
  "use strict";

  const LEVELS = {
    easy: "يتحرك الخصم عشوائيًا؛ مناسب للتجربة.",
    medium: "يفضّل المكاسب المباشرة في نقلة واحدة.",
    hard: "يبحث عدة نقلات إلى الأمام ضمن وقت محدود.",
  };

  function readSavedLevel() {
    try {
      return localStorage.getItem("fantasy-difficulty");
    } catch (_) {
      return null;
    }
  }

  function statusText(game) {
    const chess = game.chess;
    if (chess.in_checkmate()) return `كش مات — فاز ${chess.turn() === "w" ? "الأسود" : "الأبيض"}`;
    if (chess.in_draw()) return "انتهت المباراة بالتعادل";
    if (game.pending) return "الخصم يفكّر…";
    if (chess.in_check()) return chess.turn() === "w" ? "كش! احمِ ملكك" : "الخصم في كش";
    return chess.turn() === "w" ? "دورك — الأبيض" : "دور الخصم — الأسود";
  }

  function renderHistory(list, empty, moves) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < moves.length; i += 2) {
      const row = document.createElement("li");
      const number = document.createElement("span");
      number.className = "move-number";
      number.textContent = String(Math.floor(i / 2) + 1).padStart(2, "0");
      const notation = document.createElement("bdi");
      notation.dir = "ltr";
      notation.textContent = `${moves[i]}${moves[i + 1] ? `  ${moves[i + 1]}` : ""}`;
      row.append(number, notation);
      fragment.append(row);
    }
    list.replaceChildren(fragment);
    empty.hidden = moves.length > 0;
  }

  class Controls {
    constructor(elements, callbacks) {
      this.elements = elements;
      this.level = "easy";
      this.chooseLevel(readSavedLevel() || "easy");

      elements.difficulty.addEventListener("click", (event) => {
        const choice = event.target.closest("[data-difficulty]");
        if (choice) this.chooseLevel(choice.dataset.difficulty);
      });
      elements.newGame?.addEventListener("click", callbacks.onNew);
      elements.undo?.addEventListener("click", callbacks.onUndo);
    }

    chooseLevel(level) {
      if (!Object.hasOwn(LEVELS, level)) return;
      this.level = level;
      this.elements.note.textContent = LEVELS[level];
      for (const button of this.elements.difficulty.querySelectorAll("[data-difficulty]")) {
        button.setAttribute("aria-pressed", String(button.dataset.difficulty === level));
      }
      try {
        localStorage.setItem("fantasy-difficulty", level);
      } catch (_) {
        // Selecting a level must not depend on browser storage.
      }
    }

    render(game) {
      const moves = game.chess.history();
      this.elements.status.textContent = statusText(game);
      this.elements.status.classList.toggle("danger", game.chess.in_check());
      this.elements.last.textContent = moves.length
        ? `آخر نقلة: ${moves[moves.length - 1]}`
        : "ابدأ المباراة باختيار قطعة فاتحة";
      if (this.elements.undo) this.elements.undo.disabled = moves.length === 0;
      renderHistory(this.elements.history, this.elements.empty, moves);
    }
  }

  namespace.Controls = Controls;
})(window.FantasyChess);
