import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import {
  MaterialCommunityIcons,
  Ionicons,
} from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";

const TopNavBar: React.FC = () => {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error("Failed to log out: ", error);
    }
  };

  return (
    <View style={styles.header}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
      <View style={styles.headerLeft}>
        <MaterialCommunityIcons name="home" size={28} color="black" />
        <Text style={styles.headerTitle}>HomeGeek AI</Text>
      </View>
      <View style={styles.headerRight}>
        <Ionicons
          name="notifications-outline"
          size={24}
          color="black"
          style={styles.notificationIcon}
        />
        <TouchableOpacity
          style={styles.profileButton}
          onPress={handleLogout}
        >
          <Text style={styles.profileButtonText}>PR</Text>
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
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
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
    backgroundColor: "#e0e0e0",
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
