import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { Home, Bell } from "lucide-react-native";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { Colors } from "../constants/theme";
import { useTheme } from "../hooks/use-theme";

const createDynamicStyles = (themeColors: typeof Colors.light) =>
  StyleSheet.create({
    header: {
      backgroundColor: themeColors.navBarBackground,
      borderBottomColor: themeColors.navBarBorder,
    },
    headerTitle: {
      color: themeColors.text,
    },
    profileButton: {
      backgroundColor: themeColors.profileBackground,
    },
    profileButtonText: {
      color: themeColors.text,
    },
  });

const TopNavBar: React.FC = () => {
  const { colorScheme } = useTheme();
  const themeColors = Colors[colorScheme ?? "light"];
  const dynamicStyles = createDynamicStyles(themeColors);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error("Failed to log out: ", error);
    }
  };

  return (
    <View style={[styles.header, dynamicStyles.header]}>
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={themeColors.background}
      />
      <View style={styles.headerLeft}>
        <Home size={28} color={themeColors.text} />
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>
          HomeGeek AI
        </Text>
      </View>
      <View style={styles.headerRight}>
        <Bell
          size={24}
          color={themeColors.text}
          style={styles.notificationIcon}
        />
        <TouchableOpacity
          style={[styles.profileButton, dynamicStyles.profileButton]}
          onPress={handleLogout}
        >
          <Text
            style={[styles.profileButtonText, dynamicStyles.profileButtonText]}
          >
            PR
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
    // backgroundColor: Colors.common.white,
    borderBottomWidth: 1,
    // borderBottomColor: Colors.common.mediumGrey,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationIcon: {
    marginRight: 15,
  },
  profileButton: {
    // backgroundColor: Colors.common.profileBackground,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  profileButtonText: {
    fontWeight: "bold",
  },
});

export default TopNavBar;
