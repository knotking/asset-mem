import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { MaterialCommunityIcons, FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      Alert.alert("Success", "Login successful!");
      router.replace("(tabs)");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="home" size={50} color="black" />
      </View>
      <Text style={styles.welcomeBackText}>Welcome Back</Text>
      <Text style={styles.signInText}>Sign in to manage your properties</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordInputContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          >
            <MaterialCommunityIcons
              name={showPassword ? "eye-off" : "eye"}
              size={24}
              color="gray"
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.forgotPasswordButton}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signInButton} onPress={handleLogin}>
        <Text style={styles.signInButtonText}>Sign In</Text>
      </TouchableOpacity>

      <View style={styles.orContainer}>
        <View style={styles.line} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity style={styles.socialButton}>
        <FontAwesome
          name="google"
          size={20}
          color="#4285F4"
          style={styles.socialIcon}
        />
        <Text style={styles.socialButtonText}>Continue with Google</Text>
      </TouchableOpacity>

      <View style={styles.signUpContainer}>
        <Text style={styles.dontHaveAccountText}>Don't have an account? </Text>
        <TouchableOpacity>
          <Text style={styles.signUpText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  iconContainer: {
    marginBottom: 20,
  },
  welcomeBackText: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
  },
  signInText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
  },
  inputGroup: {
    width: "100%",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    padding: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
  },
  eyeIcon: {
    padding: 10,
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: 10,
  },
  forgotPasswordText: {
    color: "#007AFF",
    fontSize: 14,
  },
  signInButton: {
    width: "100%",
    backgroundColor: "#000",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 30,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  orText: {
    width: 40,
    textAlign: "center",
    color: "#888",
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    justifyContent: "center",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  socialIcon: {
    marginRight: 10,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  signUpContainer: {
    flexDirection: "row",
    marginTop: 30,
  },
  dontHaveAccountText: {
    fontSize: 16,
    color: "#666",
  },
  signUpText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "bold",
  },
});

export default AuthScreen;
