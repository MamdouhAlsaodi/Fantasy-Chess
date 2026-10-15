window.FantasyChess = window.FantasyChess || {};

(function registerGame(namespace) {
  "use strict";

  class Game {
    constructor() {
      this.chess = new Chess();
      this.generation = 0;
      this.pending = false;
      this.timer = null;
      this.redoTurns = [];
    }

    cancelAI() {
      // An old timeout must never make a move on a reset or rewound board.
      this.generation += 1;
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
      this.pending = false;
    }

    reset() {
      this.cancelAI();
      this.chess = new Chess();
      this.redoTurns = [];
    }

    undo() {
      const wasThinking = this.pending;
      this.cancelAI();
      const plies = this.chess.history().length;
      if (plies === 0) return false;

      // A complete turn includes the player's move and the AI reply.
      // A final white move or a queued AI reply only has one ply.
      const count = (wasThinking || this.chess.turn() === "b") ? 1 : Math.min(2, plies);
      const undone = [];
      for (let i = 0; i < count; i += 1) undone.unshift(this.chess.undo());
      this.redoTurns.push(undone);
      return true;
    }

    redo() {
      if (this.pending || !this.redoTurns.length) return false;
      const moves = this.redoTurns.pop();
      for (const move of moves) {
        this.chess.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
      }
      return true;
    }

    play(from, to, promotion = "q") {
      if (this.pending || this.chess.game_over() || this.chess.turn() !== "w") {
        return null;
      }
      const move = this.chess.move({ from, to, promotion });
      if (move) this.redoTurns = [];
      return move;
    }

    positionAt(ply) {
      const history = this.chess.history({ verbose: true });
      if (!Number.isInteger(ply) || ply < 0 || ply > history.length) return null;
      const snapshot = new Chess();
      for (const move of history.slice(0, ply)) {
        snapshot.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
      }
      return snapshot;
    }

    exportPgn(result = "*") {
      const outcomes = { victory: "1-0", defeat: "0-1", draw: "1/2-1/2" };
      const notation = this.positionAt(this.chess.history().length);
      notation.header("Event", "Fantasy Chess", "White", "Dawn", "Black", "Shadow",
        "Result", outcomes[result] || "*");
      return notation.pgn();
    }

    requestAI(level, onMove) {
      if (this.pending || this.chess.game_over() || this.chess.turn() !== "b") {
        return false;
      }

      this.pending = true;
      const generation = ++this.generation;
      this.timer = setTimeout(() => {
        if (generation !== this.generation) return;
        this.timer = null;

        const choice = namespace.AI.choose(this.chess, level);
        if (generation !== this.generation) return;
        if (choice) {
          this.chess.move({
            from: choice.from,
            to: choice.to,
            promotion: choice.promotion || "q",
          });
        }
        this.pending = false;
        onMove?.(choice);
      }, 120);
      return true;
    }
  }

  namespace.Game = Game;
})(window.FantasyChess);
