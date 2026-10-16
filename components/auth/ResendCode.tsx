import React from "react";
import { Pressable, Text, View } from "react-native";

export default function ResendCode({
  onResend,
  secondsLeft,
  loading,
}: ResendCodeProps) {
  const waiting = secondsLeft > 0;

  return (
    <View className='auth-resend-row'>
      <Text className='auth-link-copy'>Didn&apos;t get it?</Text>
      {waiting ? (
        <Text className='auth-link-copy'>Resend in {secondsLeft}s</Text>
      ) : (
        <Pressable
          onPress={onResend}
          disabled={loading}
          accessibilityRole='button'
          hitSlop={8}>
          <Text className='auth-link'>
            {loading ? "Sending…" : "Resend code"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
