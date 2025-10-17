import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { auth } from "../firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Home, Eye, EyeOff, Chrome } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Colors } from "../constants/theme";
import { useTheme } from "../hooks/use-theme";

const createDynamicStyles = (themeColors: typeof Colors.light) =>
  StyleSheet.create({
    container: {
      backgroundColor: themeColors.background,
    },
    createAccountText: {
      color: themeColors.text,
    },
    signUpDescriptionText: {
      color: themeColors.text,
    },
    input: {
      borderColor: themeColors.inputBorder,
      backgroundColor: themeColors.inputBackground,
      color: themeColors.inputText,
    },
    passwordInputContainer: {
      borderColor: themeColors.inputBorder,
      backgroundColor: themeColors.inputBackground,
    },
    signUpButton: {
      backgroundColor: themeColors.tint,
    },
    signUpButtonText: {
      color: themeColors.background,
    },
    line: {
      backgroundColor: themeColors.separator,
    },
    orText: {
      color: themeColors.icon,
    },
    socialButton: {
      borderColor: themeColors.border,
      backgroundColor: themeColors.background,
    },
    socialButtonText: {
      color: themeColors.text,
    },
    alreadyHaveAccountText: {
      color: themeColors.text,
    },
    signInText: {
      color: themeColors.tint,
    },
    label: {
      color: themeColors.text,
    },
  });

const SignUpScreen: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { colorScheme } = useTheme();
  const themeColors = Colors[colorScheme ?? "light"];
  const dynamicStyles = createDynamicStyles(themeColors);

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      Alert.alert("Success", "Account created successfully!");
      router.replace("/"); // Navigate to home or dashboard after sign up
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <View style={styles.iconContainer}>
        <Home size={50} color={themeColors.text} />
      </View>
      <Text style={[styles.createAccountText, dynamicStyles.createAccountText]}>
        Create Account
      </Text>
      <Text
        style={[
          styles.signUpDescriptionText,
          dynamicStyles.signUpDescriptionText,
        ]}
      >
        Sign up to get started
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, dynamicStyles.label]}>Email</Text>
        <TextInput
          style={[styles.input, dynamicStyles.input]}
          placeholder="Enter your email"
          placeholderTextColor={themeColors.icon}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, dynamicStyles.label]}>Password</Text>
        <View
          style={[
            styles.passwordInputContainer,
            dynamicStyles.passwordInputContainer,
          ]}
        >
          <TextInput
            style={[styles.passwordInput, dynamicStyles.input]}
            placeholder="Enter your password"
            placeholderTextColor={themeColors.icon}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          >
            {showPassword ? (
              <EyeOff size={24} color={themeColors.icon} />
            ) : (
              <Eye size={24} color={themeColors.icon} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, dynamicStyles.label]}>
          Confirm Password
        </Text>
        <View
          style={[
            styles.passwordInputContainer,
            dynamicStyles.passwordInputContainer,
          ]}
        >
          <TextInput
            style={[styles.passwordInput, dynamicStyles.input]}
            placeholder="Confirm your password"
            placeholderTextColor={themeColors.icon}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={styles.eyeIcon}
          >
            {showConfirmPassword ? (
              <EyeOff size={24} color={themeColors.icon} />
            ) : (
              <Eye size={24} color={themeColors.icon} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.signUpButton, dynamicStyles.signUpButton]}
        onPress={handleSignUp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={themeColors.background} />
        ) : (
          <Text
            style={[styles.signUpButtonText, dynamicStyles.signUpButtonText]}
          >
            Sign Up
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.orContainer}>
        <View style={[styles.line, dynamicStyles.line]} />
        <Text style={[styles.orText, dynamicStyles.orText]}>or</Text>
        <View style={[styles.line, dynamicStyles.line]} />
      </View>

      <TouchableOpacity
        style={[styles.socialButton, dynamicStyles.socialButton]}
      >
        <Chrome
          size={20}
          color={Colors.common.googleBlue}
          style={styles.socialIcon}
        />
        <Text style={[styles.socialButtonText, dynamicStyles.socialButtonText]}>
          Continue with Google
        </Text>
      </TouchableOpacity>

      <View style={styles.signUpContainer}>
        <Text
          style={[
            styles.alreadyHaveAccountText,
            dynamicStyles.alreadyHaveAccountText,
          ]}
        >
          Already have an account?{" "}
        </Text>
        <TouchableOpacity onPress={() => router.replace("/auth/login")}>
          <Text style={[styles.signInText, dynamicStyles.signInText]}>
            Sign In
          </Text>
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
  },
  iconContainer: {
    marginBottom: 20,
  },
  createAccountText: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
  },
  signUpDescriptionText: {
    fontSize: 16,
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
    borderRadius: 8,
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
  },
  eyeIcon: {
    padding: 10,
  },
  signUpButton: {
    width: "100%",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  signUpButtonText: {
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
  },
  orText: {
    width: 40,
    textAlign: "center",
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    marginBottom: 10,
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
  alreadyHaveAccountText: {
    fontSize: 16,
  },
  signInText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default SignUpScreen;
