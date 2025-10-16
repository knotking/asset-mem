import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import React, { useState, useEffect } from "react";

import { useColorScheme } from "../hooks/use-color-scheme";

export const unstable_settings = {
  initialRouteName: "(tabs)", // Set initial route to tabs
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isSignedIn, setIsSignedIn] = useState(false); // Placeholder for authentication state

  useEffect(() => {
    // In a real app, you would check for a token or user session here
    const checkLoginStatus = async () => {
      // Simulate async check
      await new Promise(resolve => setTimeout(resolve, 1000));
      // setIsSignedIn(true); // Set to true to bypass auth for testing tabs
    };
    checkLoginStatus();
  }, []);

  const initialRoute = isSignedIn ? "(tabs)" : "auth";

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName={initialRoute}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
