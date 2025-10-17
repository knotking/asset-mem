import React, { useContext, useEffect, useState } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ColorScheme = "light" | "dark" | null | undefined;

interface ThemeContextType {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

export const ThemeContext = React.createContext<ThemeContextType | undefined>(
  undefined
);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [colorScheme, setInternalColorScheme] =
    useState<ColorScheme>(undefined);

  useEffect(() => {
    const loadColorScheme = async () => {
      try {
        const storedScheme = await AsyncStorage.getItem("user-color-scheme");
        if (storedScheme === "light" || storedScheme === "dark") {
          setInternalColorScheme(storedScheme);
        } else {
          setInternalColorScheme(systemColorScheme);
        }
      } catch (e) {
        console.error("Failed to load color scheme from storage", e);
        setInternalColorScheme(systemColorScheme);
      }
    };
    loadColorScheme();
  }, [systemColorScheme]);

  const setColorScheme = async (scheme: ColorScheme) => {
    try {
      if (scheme) {
        await AsyncStorage.setItem("user-color-scheme", scheme);
      } else {
        await AsyncStorage.removeItem("user-color-scheme");
      }
      setInternalColorScheme(scheme);
    } catch (e) {
      console.error("Failed to save color scheme to storage", e);
    }
  };

  return (
    <ThemeContext.Provider value={{ colorScheme, setColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
