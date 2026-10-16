import { colors } from "@/constants/theme";
import { CODE_LENGTH } from "@/lib/auth";
import clsx from "clsx";
import React from "react";
import { Text, TextInput, View } from "react-native";

export default function CodeField({
  value,
  onChangeText,
  onComplete,
  error,
  autoFocus = true,
}: CodeFieldProps) {
  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    onChangeText(digits);
    if (digits.length === CODE_LENGTH && digits !== value) {
      onComplete?.(digits);
    }
  };

  return (
    <View className='auth-field'>
      <Text className='auth-label'>Verification code</Text>
      <TextInput
        value={value}
        onChangeText={handleChange}
        className={clsx("auth-code-input", error && "auth-input-error")}
        style={{ writingDirection: "ltr" }}
        placeholder='••••••'
        placeholderTextColor={colors.mutedForeground}
        keyboardType='number-pad'
        textContentType='oneTimeCode'
        autoComplete='one-time-code'
        maxLength={CODE_LENGTH}
        autoFocus={autoFocus}
        accessibilityLabel='Verification code'
        accessibilityHint='Enter the 6-digit code we sent to your email'
      />
      {error ? (
        <Text className='auth-error' accessibilityLiveRegion='polite'>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
