import { colors } from "@/constants/theme";
import { useClerk, useUser } from "@clerk/expo";
import clsx from "clsx";
import { styled } from "nativewind";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
const SafeAreaView = styled(RNSafeAreaView);

const Settings = () => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // The root navigator's protected routes send the user back to sign-in.
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView className='flex-1 bg-background p-5 gap-5'>
      <Text className='list-title'>Settings</Text>

      <View className='settings-card'>
        <Text className='settings-name'>
          {user?.firstName ?? user?.fullName ?? "Your account"}
        </Text>
        <Text className='settings-email'>
          {user?.primaryEmailAddress?.emailAddress}
        </Text>

        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          accessibilityRole='button'
          accessibilityState={{ busy: signingOut }}
          className={clsx("sub-cancel mt-5", signingOut && "sub-cancel-disabled")}>
          {signingOut ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text className='sub-cancel-text'>Sign out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default Settings;
