//register.tsx
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
  ImageBackground, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthContext'; 
import { Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { colors, isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, "", "");
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1200' }}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={styles.container} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
               <Text style={styles.title}>Join MixMatch</Text>
               <Text style={styles.subtitle}>Create an account to start matching.</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput 
                style={styles.input} 
                value={email} 
                onChangeText={setEmail} 
                autoCapitalize="none" 
                keyboardType="email-address" 
                placeholder="email@example.com" 
                placeholderTextColor="rgba(255,255,255,0.4)" 
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput 
                  style={styles.passwordInput} 
                  value={password} 
                  onChangeText={setPassword} 
                  secureTextEntry={!showPassword} 
                  placeholder="••••••••" 
                  placeholderTextColor="rgba(255,255,255,0.4)" 
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  {showPassword ? <EyeOff size={20} color="#fff" /> : <Eye size={20} color="#fff" />}
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput 
                  style={styles.passwordInput} 
                  value={confirmPassword} 
                  onChangeText={setConfirmPassword} 
                  secureTextEntry={!showConfirmPassword} 
                  placeholder="••••••••" 
                  placeholderTextColor="rgba(255,255,255,0.4)" 
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                  {showConfirmPassword ? <EyeOff size={20} color="#fff" /> : <Eye size={20} color="#fff" />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.button, loading && { opacity: 0.7 }]} 
                onPress={handleRegister} 
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Create Account</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>


          <TouchableOpacity style={styles.floatingBack} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  background: { flex: 1, backgroundColor: '#000' },
  backgroundImage: { resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  safe: { flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 120 },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  form: { width: '100%' },
  label: { fontSize: 12, fontWeight: '700', color: '#fff', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8 },
  input: { 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.2)', 
    borderRadius: 18, 
    padding: 16, 
    marginBottom: 20, 
    fontSize: 16, 
    color: '#fff' 
  },
  passwordContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.2)', 
    borderRadius: 18, 
    marginBottom: 20 
  },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: '#fff' },
  eyeIcon: { paddingRight: 16 },
  button: { 
    backgroundColor: colors.primary, 
    padding: 18, 
    borderRadius: 18, 
    alignItems: 'center', 
    marginTop: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 18 },
  floatingBack: { 
    position: 'absolute', 
    bottom: 30, 
    left: 24, 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
});