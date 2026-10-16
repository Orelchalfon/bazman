import { colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import clsx from "clsx";
import React from "react";
import { Text, View } from "react-native";

export default function FormBanner({ message, tone = "error" }: FormBannerProps) {
  if (!message) return null;
  const isError = tone === "error";

  return (
    <View
      className={clsx(
        "auth-banner",
        isError ? "auth-banner-error" : "auth-banner-info",
      )}
      accessibilityRole='alert'
      accessibilityLiveRegion='polite'>
      <Ionicons
        name={isError ? "alert-circle" : "checkmark-circle"}
        size={18}
        color={isError ? colors.destructive : colors.success}
      />
      <Text className='auth-banner-text'>{message}</Text>
    </View>
  );
}
