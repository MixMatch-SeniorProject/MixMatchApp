import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, View, Platform, Easing } from 'react-native';
import { Home, Heart, MessageCircle, User, Calendar } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import { useAuth } from '../../auth/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';

export default function TabLayout() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 64 : 72;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,

          tabBarIconStyle: {
            marginTop: 4,
            marginBottom: 2,
          },

          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            marginBottom: Platform.OS === 'android' ? 8 : 0,
          },

          animation: 'fade',
          transitionSpec: {
            animation: 'timing',
            config: {
              duration: 250,
              easing: Easing.inOut(Easing.quad),
            },
          },
          tabBarButton: HapticTab,
          sceneContainerStyle: {
            backgroundColor: colors.background,
          },
          tabBarStyle: {
            backgroundColor: colors.background,
            height: TAB_BAR_HEIGHT,
            borderTopWidth: 1,
            borderTopColor: colors.text + '08',
            marginBottom: insets.bottom,
            paddingBottom: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.text + '60',
        }}
      >
        <Tabs.Screen
          name="events"
          options={{
            tabBarLabel: 'Feed',
            tabBarIcon: ({ color }) => (
              <Calendar size={26} color={color} strokeWidth={2.2} />
            ),
          }}
        />

        <Tabs.Screen
          name="likes"
          options={{
            tabBarLabel: 'Likes',
            tabBarIcon: ({ color }) => (
              <Heart size={26} color={color} strokeWidth={2.2} />
            ),
          }}
        />

        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color }) => (
              <Home size={26} color={color} strokeWidth={2.2} />
            ),
          }}
        />

        <Tabs.Screen
          name="messages"
          options={{
            tabBarLabel: 'Messages',
            tabBarIcon: ({ color }) => (
              <MessageCircle size={26} color={color} strokeWidth={2.2} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color }) => (
              <User size={26} color={color} strokeWidth={2.2} />
            ),
          }}
        />
      </Tabs>
      {insets.bottom > 0 && (
        <View
          pointerEvents="none" 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: insets.bottom,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flex: 1, backgroundColor: colors.text + '08' }} />
        </View>
      )}
    </View>
  );
}