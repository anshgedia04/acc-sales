import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="sales-entries" />
        <Stack.Screen name="add-entry" />
        <Stack.Screen name="edit-entry" />
        <Stack.Screen name="party-ledger" />
        <Stack.Screen name="sales-summary" />
        <Stack.Screen name="monthly-party-sales" />
        <Stack.Screen name="product-summary" />
      </Stack>
      <AnimatedSplashOverlay />
    </SafeAreaProvider>
  );
}
