import React from "react";
import { Text, View } from "react-native";

export default function BrandHeader() {
  return (
    <View className='auth-brand-block' accessibilityRole='header'>
      <View className='auth-logo-wrap'>
        <View className='auth-logo-mark'>
          <Text className='auth-logo-mark-text'>B</Text>
        </View>
        <View>
          <Text className='auth-wordmark'>BazMan</Text>
          <Text className='auth-wordmark-sub'>Smart billing</Text>
        </View>
      </View>
    </View>
  );
}
