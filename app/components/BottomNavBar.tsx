import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Home, FileText, Briefcase, Settings } from "lucide-react-native";
import { Colors } from "../constants/theme";
import { useTheme } from "../hooks/use-theme";

const createDynamicStyles = (themeColors: typeof Colors.light) =>
  StyleSheet.create({
    navBar: {
      backgroundColor: themeColors.navBarBackground,
      borderTopColor: themeColors.navBarBorder,
    },
    navTextActive: {
      color: themeColors.tint,
    },
    navTextInactive: {
      color: themeColors.inactiveText,
    },
  });

const BottomNavBar: React.FC = () => {
  const { colorScheme } = useTheme();
  const themeColors = Colors[colorScheme ?? "light"];
  const dynamicStyles = createDynamicStyles(themeColors);

  return (
    <View style={[styles.navBar, dynamicStyles.navBar]}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() =>
          Alert.alert("Navigation", "Home screen functionality coming soon!")
        }
      >
        <Home size={24} color={dynamicStyles.navTextActive.color} />
        <Text style={[styles.navText, dynamicStyles.navTextActive]}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() =>
          Alert.alert(
            "Navigation",
            "Documents screen functionality coming soon!"
          )
        }
      >
        <FileText size={24} color={dynamicStyles.navTextInactive.color} />
        <Text style={[styles.navText, dynamicStyles.navTextInactive]}>
          Documents
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() =>
          Alert.alert(
            "Navigation",
            "Services screen functionality coming soon!"
          )
        }
      >
        <Briefcase size={24} color={dynamicStyles.navTextInactive.color} />
        <Text style={[styles.navText, dynamicStyles.navTextInactive]}>
          Services
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() =>
          Alert.alert(
            "Navigation",
            "Settings screen functionality coming soon!"
          )
        }
      >
        <Settings size={24} color={dynamicStyles.navTextInactive.color} />
        <Text style={[styles.navText, dynamicStyles.navTextInactive]}>
          Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    // backgroundColor: Colors.common.white,
    borderTopWidth: 1,
    // borderTopColor: Colors.common.lightBorder,
    paddingVertical: 10,
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
  navItem: {
    alignItems: "center",
  },
  navText: {
    fontSize: 12,
    // color: Colors.common.lightTextGrey,
    marginTop: 5,
  },
});

export default BottomNavBar;
