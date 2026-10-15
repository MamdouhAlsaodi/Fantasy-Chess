window.FantasyChess = window.FantasyChess || {};

(function registerFullscreen(namespace) {
  "use strict";

  class Fullscreen {
    constructor(target, button) {
      this.target = target;
      this.button = button;
      button.addEventListener("click", () => this.toggle());
      document.addEventListener("fullscreenchange", () => this.update());
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && target.classList.contains("is-immersive")) {
          target.classList.remove("is-immersive");
          this.update();
        }
      });
      this.update();
    }

    get active() {
      return document.fullscreenElement === this.target ||
        this.target.classList.contains("is-immersive");
    }

    update() {
      const active = this.active;
      this.button.setAttribute("aria-pressed", String(active));
      this.button.setAttribute("aria-label", active
        ? "أغلق عرض المعركة بملء الشاشة"
        : "افتح ساحة المعركة بملء الشاشة");
      const label = this.button.querySelector("span");
      if (label) label.textContent = active ? "إنهاء العرض" : "ملء الشاشة";
    }

    toggle() {
      if (this.target.classList.contains("is-immersive")) {
        this.target.classList.remove("is-immersive");
        this.update();
        return;
      }
      if (document.fullscreenElement === this.target) {
        document.exitFullscreen().catch(() => {});
        return;
      }
      if (typeof this.target.requestFullscreen !== "function") {
        this.target.classList.add("is-immersive");
        this.update();
        return;
      }
      this.target.requestFullscreen().catch(() => {
        // Safari/file:// may reject fullscreen: keep an accessible CSS fallback.
        this.target.classList.add("is-immersive");
        this.update();
      });
    }
  }

  namespace.Fullscreen = Fullscreen;
})(window.FantasyChess);
