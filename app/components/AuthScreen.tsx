import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Home, Eye, EyeOff, Chrome } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Colors } from "../constants/theme";
import { useTheme } from "../hooks/use-theme";

const createDynamicStyles = (themeColors: typeof Colors.light) =>
  StyleSheet.create({
    container: {
      backgroundColor: themeColors.background,
    },
    signInText: {
      color: themeColors.text,
    },
    forgotPasswordText: {
      color: themeColors.tint,
    },
    socialButton: {
      borderColor: themeColors.border,
      backgroundColor: themeColors.background,
    },
    socialButtonText: {
      color: themeColors.text,
    },
    dontHaveAccountText: {
      color: themeColors.text,
    },
    signUpText: {
      color: themeColors.tint,
      fontWeight: "bold",
    },
    welcomeBackText: {
      color: themeColors.text,
    },
    label: {
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
    forgotPasswordButtonText: {
      color: themeColors.tint,
    },
    signInButton: {
      backgroundColor: themeColors.tint,
    },
    signInButtonText: {
      color: themeColors.background,
    },
    line: {
      backgroundColor: themeColors.separator,
    },
    orText: {
      color: themeColors.icon,
    },
  });

const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { colorScheme } = useTheme();
  const themeColors = Colors[colorScheme ?? "light"];
  const dynamicStyles = createDynamicStyles(themeColors);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/");
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
      <Text style={[styles.welcomeBackText, dynamicStyles.welcomeBackText]}>
        Welcome Back
      </Text>
      <Text style={[styles.signInText, dynamicStyles.signInText]}>
        Sign in to manage your properties
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
        <TouchableOpacity style={styles.forgotPasswordButton}>
          <Text
            style={[
              styles.forgotPasswordText,
              dynamicStyles.forgotPasswordText,
            ]}
          >
            Forgot Password?
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.signInButton, dynamicStyles.signInButton]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={themeColors.background} />
        ) : (
          <Text style={[styles.signInButtonText, dynamicStyles.signInButtonText]}>
            Sign In
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
            styles.dontHaveAccountText,
            dynamicStyles.dontHaveAccountText,
          ]}
        >
          Don't have an account?{" "}
        </Text>
        <TouchableOpacity>
          <Text style={[styles.signUpText, dynamicStyles.signUpText]}>
            Sign Up
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
  welcomeBackText: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
  },
  signInText: {
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
    fontSize: 14,
  },
  signInButton: {
    width: "100%",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  signInButtonText: {
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
  dontHaveAccountText: {
    fontSize: 16,
  },
  signUpText: {
    fontSize: 16,
  },
});

export default AuthScreen;
