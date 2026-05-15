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
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, selectedRole } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "At least 6 characters";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        role: selectedRole,
        referralCode: referralCode.trim() || undefined,
      });
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again";
      Alert.alert("Registration Failed", message);
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
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            Create Account
          </Text>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: colors.secondary, borderRadius: colors.radius / 2 },
            ]}
          >
            <Ionicons
              name={selectedRole === "vendor" ? "briefcase" : "people"}
              size={14}
              color={colors.primary}
            />
            <Text style={[styles.roleBadgeText, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
              {selectedRole === "vendor" ? "Vendor" : "Customer"}
            </Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            leftIcon="person-outline"
            error={errors.name}
            testID="register-name"
          />
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="mail-outline"
            error={errors.email}
            testID="register-email"
          />
          <Input
            label="Phone Number (optional)"
            placeholder="+255 700 000 000"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon="call-outline"
            testID="register-phone"
          />
          <Input
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
            error={errors.password}
            testID="register-password"
          />
          <Input
            label="Confirm Password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
            error={errors.confirmPassword}
            testID="register-confirm-password"
          />
          <Input
            label="Referral Code (optional)"
            placeholder="e.g. JOHN1234"
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
            leftIcon="gift-outline"
            testID="register-referral"
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            size="lg"
            style={{ marginTop: 8 }}
            testID="register-submit"
          />
        </View>

        {/* Login link */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Already have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/login")} testID="go-to-login">
            <Text style={[styles.footerLink, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.terms, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
          By creating an account, you agree to our{" "}
          <Text style={{ color: colors.primary }}>Terms of Service</Text> and{" "}
          <Text style={{ color: colors.primary }}>Privacy Policy</Text>
        </Text>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  container: { paddingHorizontal: 24, flexGrow: 1 },
  header: { gap: 6, marginBottom: 28 },
  backBtn: { marginBottom: 8, alignSelf: "flex-start" },
  title: { fontSize: 28 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeText: { fontSize: 12 },
  form: { gap: 14 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14 },
  terms: { fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 18 },
});
