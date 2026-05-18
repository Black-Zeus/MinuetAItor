export const resolveThemeMode = (theme) => {
  if (theme === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }
  return theme === "dark" ? "dark" : "light";
};

export const applyThemeToDocument = (theme) => {
  const resolvedTheme = resolveThemeMode(theme);
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  return resolvedTheme;
};
