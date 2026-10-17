import { colors } from "@/constants/theme";
import { icons } from "@/constants/icons";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "nativewind";
import React from "react";
import {
  I18nManager,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import BrandHeader from "./BrandHeader";

const SafeAreaView = styled(RNSafeAreaView);

export default function AuthShell({
  title,
  subtitle,
  onBack,
  footer,
  children,
}: AuthShellProps) {
  return (
    <SafeAreaView className='auth-safe-area' edges={["top", "bottom"]}>
      {/* Edge-to-edge Android no longer resizes the window for the keyboard, so pad on both platforms. */}
      <KeyboardAvoidingView className='auth-screen' behavior='padding'>
        <ScrollView
          className='auth-scroll'
          contentContainerClassName='auth-content'
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}>
          {onBack && (
            <View className='auth-top-bar'>
              <Pressable
                onPress={onBack}
                className='auth-back'
                accessibilityRole='button'
                accessibilityLabel='Go back'
                hitSlop={8}>
                <Image
                  source={icons.back}
                  className='auth-back-icon'
                  style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
                />
              </Pressable>
            </View>
          )}

          <BrandHeader />

          <View className='auth-header'>
            <Text className='auth-title' accessibilityRole='header'>
              {title}
            </Text>
            {subtitle ? <Text className='auth-subtitle'>{subtitle}</Text> : null}
          </View>

          <View className='auth-card'>
            {children}
            {footer}
          </View>

          <View className='auth-trust-row'>
            <Ionicons
              name='lock-closed'
              size={12}
              color={colors.mutedForeground}
            />
            <Text className='auth-trust-text'>
              Secured with industry-standard encryption.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
