window.FantasyChess = window.FantasyChess || {};

(function registerBoard(namespace) {
  "use strict";

  const FILES = "abcdefgh";
  const PIECE_ASSETS = new URL("../../assets/pieces/", document.currentScript.src).href;
  const ICONS = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
  const NAMES = { p: "بيدق", n: "حصان", b: "فيل", r: "قلعة", q: "ملكة", k: "ملك" };

  function isPromotion(piece, destination) {
    return piece?.type === "p" && (destination[1] === "1" || destination[1] === "8");
  }

  function squareMarkup(square, piece, classes, selected, coordinate, focused) {
    const pieceLabel = piece ? `${piece.color === "w" ? "الأبيض" : "الأسود"} ${NAMES[piece.type]}` : "فارغ";
    const icon = piece
      ? `<img class="piece ${piece.color === "w" ? "white" : "black"}"
          src="${PIECE_ASSETS}${piece.color === "w" ? "dawn" : "shadow"}/${ICONS[piece.type]}.webp"
          alt="" draggable="false" aria-hidden="true">`
      : "";
    const label = coordinate ? `<span class="coord" aria-hidden="true">${coordinate}</span>` : "";
    return `<button type="button" class="${classes.join(" ")}" role="gridcell"
      data-square="${square}" aria-label="${square}، ${pieceLabel}"
      aria-selected="${selected}" tabindex="${focused ? 0 : -1}">${icon}${label}</button>`;
  }

  class Board {
    constructor(element, game, handlers = {}) {
      this.element = element;
      this.game = game;
      this.handlers = typeof handlers === "function" ? { onMove: handlers } : handlers;
      this.selected = null;
      this.targets = [];
      this.focused = "e2";

      element.addEventListener("click", (event) => {
        const square = event.target.closest("[data-square]");
        if (square) this.click(square.dataset.square);
      });
      element.addEventListener("keydown", (event) => this.onKeyDown(event));
      this.render();
    }

    clearSelection() {
      this.selected = null;
      this.targets = [];
      this.render();
    }

    select(square) {
      this.selected = square;
      this.targets = [...new Set(
        this.game.chess.moves({ square, verbose: true }).map((move) => move.to),
      )];
      this.render();
    }

    click(square) {
      if (this.handlers.canInteract && !this.handlers.canInteract()) return;
      if (this.game.pending || this.game.chess.game_over() || this.game.chess.turn() !== "w") {
        return;
      }

      const piece = this.game.chess.get(square);
      if (this.selected && this.targets.includes(square)) {
        const moving = this.game.chess.get(this.selected);
        if (isPromotion(moving, square)) {
          this.handlers.onPromotion?.(this.selected, square);
        } else {
          this.move(this.selected, square);
        }
        return;
      }

      if (piece?.color === "w") {
        this.select(square);
      } else {
        this.clearSelection();
      }
    }

    move(from, to, promotion) {
      const moved = this.game.play(from, to, promotion);
      if (!moved) return false;
      this.selected = null;
      this.targets = [];
      this.render();
      this.handlers.onMove?.(moved);
      return true;
    }

    onKeyDown(event) {
      const target = event.target.closest("[data-square]");
      if (!target) return;

      if (event.key === "Escape") {
        this.clearSelection();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.click(target.dataset.square);
        return;
      }

      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      const square = target.dataset.square;
      let file = FILES.indexOf(square[0]);
      let rank = Number(square[1]);
      if (event.key === "ArrowLeft") file = Math.max(0, file - 1);
      if (event.key === "ArrowRight") file = Math.min(7, file + 1);
      if (event.key === "ArrowUp") rank = Math.min(8, rank + 1);
      if (event.key === "ArrowDown") rank = Math.max(1, rank - 1);
      this.focused = `${FILES[file]}${rank}`;
      this.element.querySelector(`[data-square="${this.focused}"]`)?.focus();
    }

    render(chess = this.game.chess) {
      const previousFocus = this.element.contains(document.activeElement)
        ? document.activeElement.dataset.square
        : null;
      const last = chess.history({ verbose: true }).at(-1);
      const squares = [];

      for (let rank = 8; rank >= 1; rank -= 1) {
        for (let file = 0; file < 8; file += 1) {
          const square = `${FILES[file]}${rank}`;
          const piece = chess.get(square);
          const classes = ["square", (rank + file) % 2 ? "dark" : "light"];
          if (square === this.selected) classes.push("selected");
          if (last && (square === last.from || square === last.to)) classes.push("last");
          if (piece?.type === "k" && piece.color === chess.turn() && chess.in_check()) {
            classes.push("check");
          }
          if (this.targets.includes(square)) {
            classes.push("legal", piece ? "capture" : "quiet");
          }
          const coordinate = file === 0 ? rank : rank === 1 ? FILES[file] : "";
          squares.push(squareMarkup(square, piece, classes, square === this.selected,
            coordinate, square === this.focused));
        }
      }

      this.element.innerHTML = squares.join("");
      if (previousFocus) {
        this.focused = previousFocus;
        this.element.querySelector(`[data-square="${previousFocus}"]`)?.focus();
      }
    }
  }

  namespace.Board = Board;
})(window.FantasyChess);
