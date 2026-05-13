import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, useColorScheme } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { useTheme } from '@/constants/themeHelper';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';

function RootLayoutNav() {
  const { user, profile, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const isProfileLoading = user && profile === null;

  useEffect(() => {
    if (loading || isProfileLoading) return;
    const rootSegment = segments[0];
    const inAuthGroup = rootSegment === 'login' || rootSegment === 'register';
    const inOnboarding = rootSegment === 'onboarding';

    if (!user) {
      if (!inAuthGroup) router.replace('/login');
      return;
    }

    
    const needsOnboarding = profile.onboardingComplete !== true;

    if (needsOnboarding) {
      if (!inOnboarding) router.replace('/onboarding');
    } else {
      if (inAuthGroup || inOnboarding || !rootSegment) {
        router.replace('/(tabs)');
      }
    }
  }, [user, profile, loading, isProfileLoading, segments]);

  
  if (loading || isProfileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 10, color: colors.primary, fontWeight: '600' }}>
          {isProfileLoading ? "Loading Profile..." : "Starting MixMatch..."}
        </Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const MyDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: Colors.dark.background,
      card: Colors.dark.background,
    },
  };

  const MyLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Colors.light.background,
    },
  };

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? MyDarkTheme : MyLightTheme}>
        <StatusBar style="auto" />
        <RootLayoutNav />
      </ThemeProvider>
    </AuthProvider>
  );
}