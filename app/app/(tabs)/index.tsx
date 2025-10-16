import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import AuthScreen from "@/components/AuthScreen";
import HomeScreen from "@/components/HomeScreen";
import { auth } from "@/firebaseConfig";
import { User, onAuthStateChanged } from "firebase/auth";

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (user) {
    return <HomeScreen onLogout={() => setUser(null)} />;
  } else {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
