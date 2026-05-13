import React from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/constants/themeHelper';

export const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();

  return (
    <Animated.View 
      entering={FadeIn.duration(400)} 
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});