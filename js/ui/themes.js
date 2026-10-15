window.FantasyChess = window.FantasyChess || {};

(function registerThemes(namespace) {
  "use strict";

  // Preview art stays small; the full-size scenery is selected in tokens.css.
  const THEMES = [
    { id: "highlands", name: "المرتفعات", realm: "الغابة والحجر", image: "assets/realms/highlands.webp" },
    { id: "citadels", name: "القلاع العائمة", realm: "السحر والبنفسج", image: "assets/realms/citadels.webp" },
    { id: "glacier", name: "مملكة الجليد", realm: "الثلج والبلّور", image: "assets/realms/glacier.webp" },
    { id: "volcano", name: "حصون البركان", realm: "الجمر والصخور", image: "assets/realms/volcano.webp" },
    { id: "desert", name: "صحراء الشمس", realm: "الرمال والذهب", image: "assets/realms/desert.webp" },
  ];

  function readSavedTheme() {
    try {
      return localStorage.getItem("fantasy-theme");
    } catch (_) {
      return null; // file:// privacy modes can deny storage.
    }
  }

  class Themes {
    constructor(container, page, onChange) {
      this.container = container;
      this.page = page;
      this.onChange = onChange;
      this.selected = "highlands";
      this.render();
      this.select(readSavedTheme() || this.selected);
      container.addEventListener("click", (event) => {
        const button = event.target.closest("[data-theme-choice]");
        if (button) this.select(button.dataset.themeChoice);
      });
    }

    select(id) {
      if (!THEMES.some((theme) => theme.id === id)) return;
      this.selected = id;
      this.page.dataset.theme = id;
      this.onChange?.(id);
      for (const button of this.container.querySelectorAll("[data-theme-choice]")) {
        button.setAttribute("aria-pressed", String(button.dataset.themeChoice === id));
      }
      try {
        localStorage.setItem("fantasy-theme", id);
      } catch (_) {
        // Visual selection still works if storage is blocked.
      }
    }

    render() {
      this.container.replaceChildren();
      for (const theme of THEMES) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "theme-card";
        button.dataset.themeChoice = theme.id;
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", `مملكة ${theme.name}`);

        const image = document.createElement("img");
        image.src = theme.image;
        image.alt = "";
        image.loading = "eager";
        image.decoding = "async";
        const copy = document.createElement("span");
        copy.className = "theme-card-copy";
        const name = document.createElement("strong");
        name.textContent = theme.name;
        const realm = document.createElement("small");
        realm.textContent = theme.realm;
        copy.append(name, realm);
        button.append(image, copy);
        this.container.append(button);
      }
    }
  }

  namespace.Themes = Themes;
})(window.FantasyChess);
