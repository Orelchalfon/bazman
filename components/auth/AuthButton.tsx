import { colors } from "@/constants/theme";
import clsx from "clsx";
import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

export default function AuthButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: AuthButtonProps) {
  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      className={clsx(
        isPrimary ? "auth-button" : "auth-secondary-button",
        isPrimary && isDisabled && "auth-button-disabled",
        !isPrimary && isDisabled && "opacity-50",
        "active:opacity-80",
      )}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.primary : colors.accent} />
      ) : (
        <Text
          className={
            isPrimary ? "auth-button-text" : "auth-secondary-button-text"
          }>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
