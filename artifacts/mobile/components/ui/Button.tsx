import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const colors = useColors();

  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const containerStyle: ViewStyle = {
    borderRadius: colors.radius,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    opacity: disabled ? 0.5 : 1,
    ...getSizeStyle(size),
    ...getVariantStyle(variant, colors),
  };

  const labelStyle: TextStyle = {
    fontFamily: "Poppins_600SemiBold",
    ...getLabelSize(size),
    ...getLabelColor(variant, colors),
  };

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[containerStyle, style]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.primaryForeground : colors.primary}
          size="small"
        />
      ) : null}
      <Text style={[labelStyle, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

function getSizeStyle(size: string): ViewStyle {
  switch (size) {
    case "sm":
      return { height: 38, paddingHorizontal: 16 };
    case "lg":
      return { height: 56, paddingHorizontal: 28 };
    default:
      return { height: 48, paddingHorizontal: 24 };
  }
}

function getLabelSize(size: string): TextStyle {
  switch (size) {
    case "sm":
      return { fontSize: 13 };
    case "lg":
      return { fontSize: 17 };
    default:
      return { fontSize: 15 };
  }
}

function getVariantStyle(variant: string, colors: ReturnType<typeof useColors>): ViewStyle {
  switch (variant) {
    case "secondary":
      return { backgroundColor: colors.secondary };
    case "outline":
      return {
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: colors.border,
      };
    case "ghost":
      return { backgroundColor: "transparent" };
    case "destructive":
      return { backgroundColor: colors.destructive };
    default:
      return { backgroundColor: colors.primary };
  }
}

function getLabelColor(variant: string, colors: ReturnType<typeof useColors>): TextStyle {
  switch (variant) {
    case "secondary":
      return { color: colors.secondaryForeground };
    case "outline":
    case "ghost":
      return { color: colors.foreground };
    case "destructive":
      return { color: colors.destructiveForeground };
    default:
      return { color: colors.primaryForeground };
  }
}

const styles = StyleSheet.create({});
export default Button;
