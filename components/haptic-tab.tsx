import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        // Trigger haptics for both iOS and Android
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        

        props.onPressIn?.(ev);
      }}
    />
  );
}