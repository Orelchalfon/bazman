import { colors } from "@/constants/theme";
import { Stack } from "expo-router";

export const unstable_settings = {
  initialRouteName: "sign-up",
};

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
