window.FantasyChess = window.FantasyChess || {};

(function registerMatchFlow(namespace) {
  "use strict";

  // The match flow owns menu visibility; chess.js owns move legality and results.
  class MatchFlow {
    constructor() {
      this.phase = "menu";
      this.settingsOpen = true;
      this.result = null;
    }

    toggleSettings() {
      if (this.phase === "active") return false;
      this.settingsOpen = !this.settingsOpen;
      return this.settingsOpen;
    }

    start() {
      if (this.phase === "active") return false;
      this.phase = "active";
      this.settingsOpen = false;
      this.result = null;
      return true;
    }

    finish(result) {
      if (this.phase !== "active" || !["victory", "defeat", "draw"].includes(result)) {
        return false;
      }
      this.phase = "finished";
      this.settingsOpen = true;
      this.result = result;
      return true;
    }

    sync(chess) {
      if (this.phase !== "active" || !chess.game_over()) return false;
      if (!chess.in_checkmate()) return this.finish("draw");
      return this.finish(chess.turn() === "b" ? "victory" : "defeat");
    }
  }

  namespace.MatchFlow = MatchFlow;
})(window.FantasyChess);
