window.FantasyChess = window.FantasyChess || {};

(function registerBattleEffects(namespace) {
  "use strict";

  // Visual feedback now; the same event can drive optional sound later.
  class BattleEffects {
    constructor(boardElement) {
      this.board = boardElement;
      this.timers = new Set();
    }

    play(move, showVisual = true) {
      if (!move) return;
      const detail = Object.freeze({
        from: move.from,
        to: move.to,
        san: move.san,
        color: move.color,
        capture: Boolean(move.captured),
        check: /[+#]$/.test(move.san || ""),
      });
      this.board.dispatchEvent(new CustomEvent("fantasy:move", {
        detail,
        bubbles: true,
      }));

      if (!showVisual) return;
      const square = this.board.querySelector(`[data-square="${move.to}"]`);
      if (!square) return;
      const effect = detail.capture ? "effect-capture" : "effect-move";
      square.classList.add(effect);
      const timer = setTimeout(() => {
        square.classList.remove(effect);
        this.timers.delete(timer);
      }, 650);
      this.timers.add(timer);
    }

    clear() {
      for (const timer of this.timers) clearTimeout(timer);
      this.timers.clear();
      for (const square of this.board.querySelectorAll(".effect-move, .effect-capture")) {
        square.classList.remove("effect-move", "effect-capture");
      }
    }
  }

  namespace.BattleEffects = BattleEffects;
})(window.FantasyChess);
