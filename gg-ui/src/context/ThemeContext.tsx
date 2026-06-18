import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";
type ViewMode = "owner" | "operator";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  devNotes: boolean;
  setDevNotes: (val: boolean) => void;
  toggleDevNotes: () => void;
}

const THEME_STORAGE_KEY = "paperclip.theme";
const VIEW_MODE_STORAGE_KEY = "gg.viewMode";
const DEV_NOTES_STORAGE_KEY = "gg.devNotes";
const DARK_THEME_COLOR = "#18181b";
const LIGHT_THEME_COLOR = "#ffffff";
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function resolveViewMode(): ViewMode {
  if (typeof window === "undefined") return "owner";
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === "operator" ? "operator" : "owner";
  } catch {
    return "owner";
  }
}

function resolveDevNotes(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEV_NOTES_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function hasStoredTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark";
  } catch {
    return false;
  }
}

function applyTheme(theme: Theme, viewMode: ViewMode, devNotes: boolean) {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta instanceof HTMLMetaElement) {
    themeColorMeta.setAttribute("content", isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }

  // Sync mode-owner/mode-operator classes and data-mode attribute on body
  document.body.classList.toggle("mode-owner", viewMode === "owner");
  document.body.classList.toggle("mode-operator", viewMode === "operator");
  document.body.setAttribute("data-mode", viewMode);

  // Sync show-devnotes class on body
  document.body.classList.toggle("show-devnotes", devNotes);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => resolveViewMode());
  const [devNotes, setDevNotesState] = useState<boolean>(() => resolveDevNotes());

  // Link theme with viewMode: owner = light, operator = dark
  const [theme, setThemeState] = useState<Theme>(() => {
    const initialMode = resolveViewMode();
    return initialMode === "operator" ? "dark" : "light";
  });

  const [hasExplicitChoice, setHasExplicitChoice] = useState<boolean>(() => hasStoredTheme());

  const setTheme = useCallback((nextTheme: Theme) => {
    setHasExplicitChoice(true);
    setThemeState(nextTheme);
    setViewModeState(nextTheme === "dark" ? "operator" : "owner");
  }, []);

  const toggleTheme = useCallback(() => {
    setHasExplicitChoice(true);
    setThemeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      setViewModeState(next === "dark" ? "operator" : "owner");
      return next;
    });
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setHasExplicitChoice(true);
    setViewModeState(mode);
    setThemeState(mode === "operator" ? "dark" : "light");
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {}
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === "owner" ? "operator" : "owner");
  }, [setViewMode, viewMode]);

  const setDevNotes = useCallback((val: boolean) => {
    setDevNotesState(val);
    try {
      localStorage.setItem(DEV_NOTES_STORAGE_KEY, val ? "true" : "false");
    } catch {}
  }, []);

  const toggleDevNotes = useCallback(() => {
    setDevNotes(!devNotes);
  }, [setDevNotes, devNotes]);

  useEffect(() => {
    applyTheme(theme, viewMode, devNotes);
    if (!hasExplicitChoice) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, [theme, viewMode, devNotes, hasExplicitChoice]);

  // When the user has not made an explicit choice, follow OS-level
  // prefers-color-scheme changes
  useEffect(() => {
    if (hasExplicitChoice) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const nextTheme = event.matches ? "dark" : "light";
      setThemeState(nextTheme);
      setViewModeState(nextTheme === "dark" ? "operator" : "owner");
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [hasExplicitChoice]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      viewMode,
      setViewMode,
      toggleViewMode,
      devNotes,
      setDevNotes,
      toggleDevNotes,
    }),
    [theme, setTheme, toggleTheme, viewMode, setViewMode, toggleViewMode, devNotes, setDevNotes, toggleDevNotes],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
