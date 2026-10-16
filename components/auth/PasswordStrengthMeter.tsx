import { colors } from "@/constants/theme";
import { getPasswordStrength } from "@/lib/auth";
import React from "react";
import { Text, View } from "react-native";

const LEVELS = [
  { label: "Use 8+ characters with letters and numbers", color: colors.mutedForeground },
  { label: "Weak", color: colors.destructive },
  { label: "Good", color: colors.accent },
  { label: "Strong", color: colors.success },
] as const;

export default function PasswordStrengthMeter({
  password,
}: PasswordStrengthMeterProps) {
  const strength = getPasswordStrength(password);
  const level = LEVELS[strength];

  return (
    <View className='gap-2'>
      <View className='auth-strength-row'>
        {[1, 2, 3].map((step) => (
          <View
            key={step}
            className='auth-strength-bar'
            style={step <= strength ? { backgroundColor: level.color } : undefined}
          />
        ))}
      </View>
      <Text className='auth-helper' style={strength ? { color: level.color } : undefined}>
        {level.label}
      </Text>
    </View>
  );
}
