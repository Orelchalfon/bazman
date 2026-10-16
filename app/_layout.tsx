import "@/global.css";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "sans-regular": require("@/assets/fonts/Rubik-Regular.ttf"),
    "sans-light": require("@/assets/fonts/Rubik-Light.ttf"),
    "sans-medium": require("@/assets/fonts/Rubik-Medium.ttf"),
    "sans-semibold": require("@/assets/fonts/Rubik-SemiBold.ttf"),
    "sans-bold": require("@/assets/fonts/Rubik-Bold.ttf"),
    "sans-extrabold": require("@/assets/fonts/Rubik-ExtraBold.ttf"),
  });
  useEffect(() => {
    if (!fontsLoaded) {
      SplashScreen.hideAsync();
    }
    if (fontError) {
      console.error("Error loading fonts:", fontError);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
