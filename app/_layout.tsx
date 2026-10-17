import "@/global.css";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { PostHogProvider } from "posthog-react-native";
import { useEffect, useRef } from "react";

import { posthog } from "@/lib/posthog";

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add it to your .env file (see .env.example).",
  );
}

/** Associates the current Clerk user with PostHog once per user ID while mounted. */
function PostHogIdentity() {
  const { user } = useUser();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      if (identifiedUserId.current) {
        posthog?.reset();
      }
      identifiedUserId.current = null;
      return;
    }

    if (!posthog || identifiedUserId.current === user.id) {
      return;
    }

    const name = user.fullName;

    posthog.identify(user.id, {
      ...(name ? { name } : {}),
    });
    identifiedUserId.current = user.id;
  }, [user]);

  return null;
}

/** Waits for fonts and authentication before rendering routes guarded by sign-in state. */
function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    "sans-regular": require("@/assets/fonts/Rubik-Regular.ttf"),
    "sans-light": require("@/assets/fonts/Rubik-Light.ttf"),
    "sans-medium": require("@/assets/fonts/Rubik-Medium.ttf"),
    "sans-semibold": require("@/assets/fonts/Rubik-SemiBold.ttf"),
    "sans-bold": require("@/assets/fonts/Rubik-Bold.ttf"),
    "sans-extrabold": require("@/assets/fonts/Rubik-ExtraBold.ttf"),
  });
  const fontsReady = fontsLoaded || !!fontError;
  const ready = fontsReady && isLoaded;

  useEffect(() => {
    if (fontError) {
      console.error("Error loading fonts:", fontError);
    }
  }, [fontError]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!isSignedIn}>
        <Stack.Screen name='(tabs)' />
        <Stack.Screen name='subscriptions/[id]' />
        <Stack.Screen name='onboarding' />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name='(auth)' />
      </Stack.Protected>
    </Stack>
  );
}

/** Wraps navigation with the analytics provider and identity sync when PostHog is configured. */
function PostHogRoot() {
  if (!posthog) {
    return <RootNavigator />;
  }

  return (
    <PostHogProvider client={posthog}>
      <PostHogIdentity />
      <RootNavigator />
    </PostHogProvider>
  );
}

/** Provides Clerk authentication to the app's analytics and navigation components. */
export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <PostHogRoot />
    </ClerkProvider>
  );
}
