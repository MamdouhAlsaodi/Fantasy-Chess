/* A short visible charge makes chess movement read as a battlefield action. */
(function registerWarMotion(namespace) {
  "use strict";

  class WarMotion {
    constructor() { this.current = null; }

    begin(group, from, to, startedAt) {
      this.cancel();
      this.current = { group, from: from.clone(), to: to.clone(), startedAt };
      group.position.copy(from);
    }

    update(now) {
      if (!this.current) return;
      const { group, from, to, startedAt } = this.current;
      const progress = Math.max(0, Math.min(1, (now - startedAt) / 600));
      const eased = progress * progress * (3 - 2 * progress);
      group.position.copy(from).lerp(to, eased);
      group.position.y += Math.sin(Math.PI * progress) * .24;
      if (progress === 1) this.current = null;
    }

    cancel() {
      if (!this.current) return;
      this.current.group.position.copy(this.current.to);
      this.current = null;
    }
  }

  namespace.WarMotion = WarMotion;
})(window.FantasyChess = window.FantasyChess || {});
