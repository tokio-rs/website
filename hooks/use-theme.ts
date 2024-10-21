import React from "react";

// This supresses the `useLayoutEffect` usage warning on server side
if (typeof window === 'undefined') {
  React.useLayoutEffect = () => {}
}

let initDone = false;

export const useTheme = () => {

  // This effect selects the theme from preferences or storage
  React.useLayoutEffect(() => {
    if (initDone) {
      // return early if the effect has ran once
      return;
    }
    initDone = true;

    // getting theme value from local storage
    const savedTheme = localStorage.getItem('data-theme');
    if (savedTheme) {
      // if user has theme in localStorage, set it on body element
      document.body.setAttribute('data-theme', savedTheme);
      return;
    }

    // When localStorage does not contain theme value
    // Read user color preference on device
    const darkModePreferred = matchMedia('(prefers-color-scheme: dark)').matches;
    // set theme value on body element as per device preference
    document.body.setAttribute('data-theme', darkModePreferred ? 'dark' : 'light');
  }, []);


  // This effects adds the change listener on "prefers-color-scheme: dark" media query
  React.useEffect(() => {
    // Preferred Theme Media Query
    const themeMediaQuery = matchMedia('(prefers-color-scheme: dark)');

    // Handles preferred color scheme change
    function onPreferColorSchemeChange(event: MediaQueryListEvent) {
      // Remove saved theme data in localStorage on change of theme preference
      localStorage.removeItem('data-theme');
      // Setting new preferred theme on body element
      document.body.setAttribute('data-theme', event.matches ? 'dark' : 'light');
    }

    themeMediaQuery.addEventListener("change", onPreferColorSchemeChange);
    return () => {
      themeMediaQuery.removeEventListener("change", onPreferColorSchemeChange);
    }
  }, []);
}
