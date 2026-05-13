import { Audio } from 'expo-av';

let soundInstance: Audio.Sound | null = null;
let isInitializing = false; 

export const playPreview = async (url: string) => {
  // If we are already trying to load a song, ignore new requests 
  // until the current one is handled.
  if (isInitializing) return;
  
  try {
    isInitializing = true;

    // Stop everything current
    if (soundInstance) {
      await soundInstance.stopAsync();
      await soundInstance.unloadAsync();
      soundInstance = null;
    }

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: 1, 
      shouldDuckAndroid: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, isLooping: true, volume: 0.5 }
    );
    
    soundInstance = sound;
  } catch (error) {
    console.error("Playback Error:", error);
  } finally {
    isInitializing = false; // Release the lock
  }
};

export const stopPreview = async () => {
  if (soundInstance) {
    try {
      await soundInstance.stopAsync();
      await soundInstance.unloadAsync();
      soundInstance = null;
    } catch (e) {
    }
  }
};

export const getStatus = async () => {
  if (soundInstance) {
    const status = await soundInstance.getStatusAsync();
    if (status.isLoaded) {
      return {
        position: status.positionMillis,
        duration: status.durationMillis || 30000,
      };
    }
  }
  return null;
};