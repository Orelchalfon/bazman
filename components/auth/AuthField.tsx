import { colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import clsx from "clsx";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export default function AuthField({
  label,
  error,
  helper,
  labelAccessory,
  secureToggle,
  ltr,
  ref,
  style,
  ...inputProps
}: AuthFieldProps) {
  const [hidden, setHidden] = useState(true);
  // Only pass a style when needed: a falsy entry here drops the className styles.
  const inputStyle = ltr ? [{ writingDirection: "ltr" as const }, style] : style;

  return (
    <View className='auth-field'>
      <View className='auth-label-row'>
        <Text className='auth-label'>{label}</Text>
        {labelAccessory}
      </View>

      {secureToggle ? (
        <View className={clsx("auth-input-row", error && "auth-input-error")}>
          <TextInput
            ref={ref}
            className='auth-input-bare'
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={hidden}
            accessibilityLabel={label}
            style={inputStyle}
            {...inputProps}
          />
          <Pressable
            onPress={() => setHidden((value) => !value)}
            className='auth-eye'
            accessibilityRole='button'
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={8}>
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>
      ) : (
        <TextInput
          ref={ref}
          className={clsx("auth-input", error && "auth-input-error")}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={label}
          style={inputStyle}
          {...inputProps}
        />
      )}

      {error ? (
        <Text className='auth-error' accessibilityLiveRegion='polite'>
          {error}
        </Text>
      ) : helper ? (
        typeof helper === "string" ? (
          <Text className='auth-helper'>{helper}</Text>
        ) : (
          helper
        )
      ) : null}
    </View>
  );
}
