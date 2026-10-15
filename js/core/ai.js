window.FantasyChess = window.FantasyChess || {};

(function registerAI(namespace) {
  "use strict";

  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE = 100_000;
  const SEARCH_DEPTH = 3;
  const MAX_NODES = 6_000;
  const MAX_MILLISECONDS = 450;

  class SearchInterrupted extends Error {}

  function positionScore(piece, rank, file) {
    const centre = Math.max(0, 7 - Math.abs(file - 3.5) - Math.abs(rank - 4.5));
    if (piece.type === "p") {
      const advance = piece.color === "b" ? 7 - rank : rank - 2;
      const centralFile = 3.5 - Math.abs(file - 3.5);
      const centralRank = Math.max(0, 4 - Math.abs(rank - 4.5));
      return centralFile * 8 + centralRank * (2 + centralFile * 3) + advance * 3;
    }
    if (piece.type === "n") return centre * 6;
    if (piece.type === "b") return centre * 3;
    return 0;
  }

  function evaluate(chess, positional = false) {
    if (chess.in_checkmate()) return chess.turn() === "b" ? -MATE : MATE;
    if (chess.in_draw()) return 0;

    let score = 0;
    const board = chess.board();
    for (let row = 0; row < board.length; row += 1) {
      for (let file = 0; file < board[row].length; file += 1) {
        const piece = board[row][file];
        if (!piece) continue;
        const value = VALUE[piece.type] + (positional
          ? positionScore(piece, 8 - row, file) : 0);
        score += (piece.color === "b" ? 1 : -1) * value;
      }
    }
    // Small check bonus breaks some material ties without overruling captures.
    if (chess.in_check()) score += chess.turn() === "w" ? 18 : -18;
    return score;
  }

  function orderedMoves(chess) {
    return chess.moves({ verbose: true }).sort((left, right) => {
      const priority = (move) =>
        (move.captured ? VALUE[move.captured] * 10 - VALUE[move.piece] : 0) +
        (move.promotion ? VALUE[move.promotion] : 0);
      return priority(right) - priority(left);
    });
  }

  function pick(moves, random) {
    const index = Math.min(moves.length - 1, Math.floor(random() * moves.length));
    return moves[index];
  }

  function onePly(chess, moves, random, positional = false) {
    let best = -Infinity;
    let candidates = [];
    for (const move of moves) {
      chess.move(move);
      const score = evaluate(chess, positional);
      chess.undo();
      if (score > best) {
        best = score;
        candidates = [move];
      } else if (score === best) {
        candidates.push(move);
      }
    }
    return pick(candidates, random);
  }

  function checkBudget(context) {
    context.nodes += 1;
    if (context.nodes > MAX_NODES || performance.now() > context.deadline) {
      throw new SearchInterrupted();
    }
  }

  function minimax(chess, depth, alpha, beta, context) {
    checkBudget(context);
    if (depth === 0 || chess.game_over()) return evaluate(chess, true);

    const blackToMove = chess.turn() === "b";
    let best = blackToMove ? -Infinity : Infinity;
    for (const move of orderedMoves(chess)) {
      chess.move(move);
      let score;
      try {
        score = minimax(chess, depth - 1, alpha, beta, context);
      } finally {
        chess.undo();
      }
      best = blackToMove ? Math.max(best, score) : Math.min(best, score);
      if (blackToMove) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  function searchDepth(chess, moves, depth, context, random) {
    let best = -Infinity;
    let candidates = [];
    for (const move of moves) {
      chess.move(move);
      let score;
      try {
        score = minimax(chess, depth - 1, -Infinity, Infinity, context);
      } finally {
        chess.undo();
      }
      if (score > best) {
        best = score;
        candidates = [move];
      } else if (score === best) {
        candidates.push(move);
      }
    }
    return pick(candidates, random);
  }

  function choose(chess, level, random = Math.random) {
    const moves = orderedMoves(chess);
    if (!moves.length) return null;
    if (level === "easy") return pick(moves, random);
    if (level === "medium") return onePly(chess, moves, random);

    // Iterative deepening returns only a completed depth; a partial pass
    // cannot give unfair preference to moves near the front of the list.
    const context = { nodes: 0, deadline: performance.now() + MAX_MILLISECONDS };
    let choice = onePly(chess, moves, random, true);
    for (let depth = 2; depth <= SEARCH_DEPTH; depth += 1) {
      try {
        choice = searchDepth(chess, moves, depth, context, random);
      } catch (error) {
        if (!(error instanceof SearchInterrupted)) throw error;
        break;
      }
    }
    return choice;
  }

  namespace.AI = { choose, evaluate };
})(window.FantasyChess);
