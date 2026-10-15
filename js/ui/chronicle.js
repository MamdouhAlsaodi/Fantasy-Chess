window.FantasyChess = window.FantasyChess || {};

(function registerChronicle(namespace) {
  "use strict";

  // A read-only cursor: changing the viewed ply never rewinds the real game.
  class Chronicle {
    constructor(elements, callbacks = {}) {
      this.elements = elements;
      this.callbacks = callbacks;
      this.ply = null; // null means the live board; zero means the initial position.
      this.game = null;
      this.phase = "menu";
      elements.undo.addEventListener("click", () => callbacks.onUndo?.());
      elements.redo.addEventListener("click", () => callbacks.onRedo?.());
      elements.back.addEventListener("click", () => this.step(-1));
      elements.next.addEventListener("click", () => this.step(1));
      elements.live.addEventListener("click", () => this.select(this.game?.chess.history().length));
      elements.moves.addEventListener("click", (event) => {
        const choice = event.target.closest("[data-ply]");
        if (choice && elements.moves.contains(choice)) this.select(Number(choice.dataset.ply));
      });
    }

    get active() { return this.ply !== null; }

    reset() { this.ply = null; }

    select(ply) {
      if (!this.game) return false;
      const length = this.game.chess.history().length;
      if (!Number.isInteger(ply) || ply < 0 || ply > length) return false;
      this.ply = ply === length ? null : ply;
      this.render(this.game, this.phase);
      this.callbacks.onChange?.(this.ply);
      return true;
    }

    step(direction) {
      if (!this.game) return false;
      const length = this.game.chess.history().length;
      if (direction === -1 && length) return this.select(Math.max(0, (this.ply ?? length) - 1));
      if (direction === 1 && this.active) return this.select(Math.min(length, this.ply + 1));
      return false;
    }

    render(game, phase) {
      this.game = game;
      this.phase = phase;
      const moves = game.chess.history();
      if (this.ply !== null && this.ply > moves.length) this.ply = null;
      this.elements.undo.disabled = phase !== "active" || this.active || moves.length === 0;
      this.elements.redo.disabled = phase !== "active" || this.active || game.pending || game.redoTurns.length === 0;
      this.elements.back.disabled = moves.length === 0 || this.ply === 0;
      this.elements.next.disabled = !this.active;
      this.elements.live.disabled = !this.active;
      this.elements.live.setAttribute("aria-pressed", String(!this.active));
      this.elements.notice.textContent = this.active
        ? `مشاهدة النقلة ${this.ply} من ${moves.length} — المباراة لم تتغير. عُد للرقعة المباشرة لتلعب.`
        : "الرقعة المباشرة — اضغط نقلة لعرضها دون تغيير المباراة.";

      const focusedPly = this.elements.moves.contains(document.activeElement)
        ? document.activeElement.dataset.ply : null;
      const fragment = document.createDocumentFragment();
      const add = (ply, label) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.ply = String(ply);
        button.textContent = label;
        button.setAttribute("aria-label", ply === 0 ? "عرض وضع البداية" : `عرض الوضع بعد ${label}`);
        if (this.ply === ply) button.setAttribute("aria-current", "step");
        fragment.append(button);
      };
      add(0, "البداية");
      moves.forEach((san, index) => add(index + 1,
        `${Math.floor(index / 2) + 1}${index % 2 ? "..." : "."} ${san}`));
      this.elements.moves.replaceChildren(fragment);
      if (focusedPly !== null) {
        this.elements.moves.querySelector(`[data-ply="${focusedPly}"]`)?.focus({ preventScroll: true });
      }
    }
  }

  namespace.Chronicle = Chronicle;
})(window.FantasyChess);
