window.FantasyChess = window.FantasyChess || {};

(function registerViewMode(namespace) {
  "use strict";

  // Switch presentation only. The 2D Board/Game still own all chess rules.
  class ViewMode {
    constructor(elements, createView, callbacks = {}) {
      this.elements = elements;
      this.createView = createView;
      this.callbacks = callbacks;
      this.mode = "2d";
      this.view = null;
      elements.button.hidden = false;
      elements.button.addEventListener("click", () => this.toggle());
      this.updateButton();
    }

    get active() { return this.mode === "3d"; }

    updateButton() {
      this.elements.button.textContent = this.active ? "2D" : "3D";
      this.elements.button.setAttribute("aria-pressed", String(this.active));
      this.elements.button.setAttribute("aria-label", this.active
        ? "العودة إلى ساحة الشطرنج ثنائية الأبعاد"
        : "الانتقال إلى ساحة شطرنج ثلاثية الأبعاد");
    }

    toggle() {
      const { board2d, board3d, frame } = this.elements;
      if (this.active) {
        this.view.setActive(false);
        board3d.hidden = true;
        board2d.hidden = false;
        frame.classList.remove("is-three");
        this.mode = "2d";
        this.updateButton();
        this.callbacks.onChange?.(this.mode);
        return true;
      }

      board2d.hidden = true;
      board3d.hidden = false;
      frame.classList.add("is-three");
      try {
        if (!this.view) {
          this.view = this.createView();
          if (!this.view?.init()) throw new Error("تعذّر تشغيل WebGL لهذا المتصفح.");
        }
        this.view.resize();
        this.view.setActive(true);
        this.mode = "3d";
        this.updateButton();
        this.callbacks.onChange?.(this.mode);
        return true;
      } catch (error) {
        this.view?.destroy();
        this.view = null;
        board3d.hidden = true;
        board2d.hidden = false;
        frame.classList.remove("is-three");
        this.mode = "2d";
        this.updateButton();
        this.elements.button.disabled = true;
        this.callbacks.onError?.(error);
        return false;
      }
    }

    render(...args) {
      if (!this.active) return;
      this.view.resize(); // Battle/immersive layouts can change without a window resize.
      this.view.render(...args);
    }

    resize() {
      if (this.active) this.view.resize();
    }

    destroy() {
      this.view?.destroy();
      this.view = null;
    }
  }

  namespace.ViewMode = ViewMode;
})(window.FantasyChess);
