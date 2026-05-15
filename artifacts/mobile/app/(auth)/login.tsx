import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validate = () => {
    let valid = true;
    setEmailError("");
    setPasswordError("");
    if (!email.trim()) { setEmailError("Email is required"); valid = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { setEmailError("Enter a valid email"); valid = false; }
    if (!password) { setPasswordError("Password is required"); valid = false; }
    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Please check your credentials";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.outer, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 32,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo & title */}
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
            <Text style={[styles.logoText, { fontFamily: "Poppins_700Bold" }]}>A</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Sign in to continue planning amazing events
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="mail-outline"
            error={emailError}
            testID="login-email"
          />
          <Input
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
            error={passwordError}
            testID="login-password"
          />

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotBtn}
            testID="forgot-password"
          >
            <Text style={[styles.forgotText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={{ marginTop: 8 }}
            testID="login-submit"
          />
        </View>

        {/* Sign up link */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Don't have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/role")} testID="go-to-register">
            <Text style={[styles.footerLink, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  container: { paddingHorizontal: 24, flexGrow: 1 },
  header: { alignItems: "center", gap: 10, marginBottom: 36 },
  logoMark: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoText: { fontSize: 32, color: "#fff" },
  title: { fontSize: 28 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  form: { gap: 16 },
  forgotBtn: { alignSelf: "flex-end" },
  forgotText: { fontSize: 13 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14 },
});
