import React from "react";
import { View, Text, StyleSheet, Button, Switch } from "react-native";
import { useTheme } from "../../hooks/use-theme";
import { signOut } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/theme";

const createDynamicStyles = (themeColors: typeof Colors.light) =>
  StyleSheet.create({
    container: {
      backgroundColor: themeColors.background,
    },
    title: {
      color: themeColors.text,
    },
    themeToggleText: {
      color: themeColors.text,
    },
  });

export default function SettingsScreen() {
  const router = useRouter();
  const { colorScheme, setColorScheme } = useTheme();
  const themeColors = Colors[colorScheme ?? "light"];
  const dynamicStyles = createDynamicStyles(themeColors);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("auth");
    } catch (error: any) {
      console.error("Failed to log out: ", error);
    }
  };

  const toggleTheme = () => {
    setColorScheme(colorScheme === "light" ? "dark" : "light");
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <Text style={[styles.title, dynamicStyles.title]}>Settings Screen</Text>
      <View style={styles.themeToggleContainer}>
        <Text style={[styles.themeToggleText, dynamicStyles.themeToggleText]}>
          Dark Mode
        </Text>
        <Switch value={colorScheme === "dark"} onValueChange={toggleTheme} />
      </View>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  themeToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  themeToggleText: {
    fontSize: 18,
    marginRight: 10,
  },
});
