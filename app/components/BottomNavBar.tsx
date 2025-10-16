import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import {
  MaterialCommunityIcons,
  FontAwesome,
  Ionicons,
} from "@expo/vector-icons";

const BottomNavBar: React.FC = () => {
  return (
    <View style={styles.navBar}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() =>
          Alert.alert("Navigation", "Home screen functionality coming soon!")
        }
      >
        <MaterialCommunityIcons name="home" size={24} color="#007AFF" />
        <Text style={[styles.navText, { color: "#007AFF" }]}>Home</Text>
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
        <FontAwesome name="file-text-o" size={24} color="gray" />
        <Text style={styles.navText}>Documents</Text>
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
        <MaterialCommunityIcons
          name="briefcase-outline"
          size={24}
          color="gray"
        />
        <Text style={styles.navText}>Services</Text>
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
        <Ionicons name="settings-outline" size={24} color="gray" />
        <Text style={styles.navText}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
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
    color: "gray",
    marginTop: 5,
  },
});

export default BottomNavBar;
