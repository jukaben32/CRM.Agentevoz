"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "voiceops-theme";

/**
 * Lee el tema guardado en localStorage. Si el usuario nunca lo cambió,
 * usa la preferencia de su sistema operativo como valor inicial.
 */
function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage puede fallar en modo privado; seguimos con el valor por defecto
  }

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

/**
 * Aplica el tema al elemento <html> añadiendo o quitando la clase "dark",
 * que es lo que activa las variables oscuras definidas en globals.css.
 */
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Hook para leer y cambiar el tema (claro/oscuro) del panel.
 * Guarda la preferencia en localStorage para que se recuerde en la próxima visita.
 */
export function useTheme() {
  // Se inicializa en "light" y se corrige en el useEffect para evitar
  // diferencias entre el render del servidor y el del navegador.
  const [theme, setThemeState] = useState<Theme>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initial = getPreferredTheme();
    setThemeState(initial);
    applyTheme(initial);
    setIsReady(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Si localStorage no está disponible, el tema simplemente no persiste
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme, isReady };
}
