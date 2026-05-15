import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) { setEmailError("Email is required"); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setEmailError("Enter a valid email"); return; }
    setEmailError("");
    setLoading(true);
    try {
      const res = await fetch(
        `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      await res.json();
      setSent(true);
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
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
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 20,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        {!sent ? (
          <>
            <View style={styles.iconWrap}>
              <View style={[styles.iconCircle, { backgroundColor: colors.secondary, borderRadius: 40 }]}>
                <Ionicons name="lock-open-outline" size={36} color={colors.primary} />
              </View>
            </View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Reset Password
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
            <View style={styles.form}>
              <Input
                label="Email Address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
                error={emailError}
                testID="forgot-email"
              />
              <Button
                title="Send Reset Link"
                onPress={handleSend}
                loading={loading}
                size="lg"
                testID="forgot-submit"
              />
            </View>
          </>
        ) : (
          <View style={styles.successContainer}>
            <View style={[styles.iconCircle, { backgroundColor: "#E8F8F3", borderRadius: 40 }]}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            </View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Check Your Email
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              We've sent password reset instructions to{"\n"}
              <Text style={{ color: colors.foreground, fontFamily: "Poppins_600SemiBold" }}>{email}</Text>
            </Text>
            <Button
              title="Back to Login"
              onPress={() => router.replace("/(auth)/login")}
              variant="outline"
              size="lg"
              style={{ marginTop: 16 }}
            />
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  container: { paddingHorizontal: 24, flexGrow: 1 },
  backBtn: { marginBottom: 32, alignSelf: "flex-start" },
  iconWrap: { marginBottom: 24 },
  iconCircle: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, marginBottom: 10 },
  subtitle: { fontSize: 14, lineHeight: 22, marginBottom: 32 },
  form: { gap: 16 },
  successContainer: { flex: 1, alignItems: "center", gap: 16, paddingTop: 40 },
});
