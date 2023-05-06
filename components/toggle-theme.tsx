import React from "react";
import { DarkThemeIcon, LightThemeIcon } from "./icons";

const ToggleTheme: React.FC = () => {
  /**
   * Handles theme change
   */
  const toggleTheme = () => {
    const THEME_KEY = 'data-theme';

    // getting current theme from body element
    const currentTheme = document.body.getAttribute(THEME_KEY);

    // new theme, opposite to current theme
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    // set new theme on body element
    document.body.setAttribute(THEME_KEY, newTheme);
    // set new theme in local storage
    localStorage.setItem(THEME_KEY, newTheme);
  };

  return (
    <div className="toggle-theme__container">
      <button className="toggle-theme__btn" onClick={toggleTheme}>
        <LightThemeIcon className="toggle-theme__icon--light" />
        <DarkThemeIcon className="toggle-theme__icon--dark" />
      </button>
    </div>
  );
};

export default ToggleTheme;
