import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ImageBackground, StatusBar, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthContext';
import { Eye, EyeOff, Music, MessageCircleHeart, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

type ViewState = 'landing' | 'login' | 'forgotPassword';

export default function LoginScreen() {
  const router = useRouter();
  const { login, resetPassword } = useAuth();
  const { colors, isDark } = useTheme();

  const [view, setView] = useState<ViewState>('landing');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      if (resetPassword) {
        await resetPassword(email);
        Alert.alert('Check Your Email', 'If an account exists for that email, we have sent password reset instructions.');
        setView('login'); // Send them back to the login view after success
      } else {
        Alert.alert('Error', 'Reset password function not implemented in AuthContext yet.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not send reset email');
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
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >


            <View style={styles.topSection}>
              <View style={styles.logoBadge}>
                <Music size={28} color="#fff" />
              </View>
              <Text style={styles.brandText}>MixMatch</Text>

              <Animated.View key={view} entering={FadeIn} exiting={FadeOut}>
                <Text style={styles.titleText}>

                  {view === 'landing' ? 'Match through music.' :
                    view === 'login' ? 'Welcome Back' : 'Reset Password'}
                </Text>

                {view === 'landing' && (
                  <>
                    <Text style={styles.subtitleText}>
                      Find people who actually vibe with your taste, then start the conversation naturally.
                    </Text>

                    <View style={styles.featureRow}>
                      <View style={styles.featurePill}>
                        <Music size={16} color="#fff" />
                        <Text style={styles.featureText}>Shared taste</Text>
                      </View>
                      <View style={styles.featurePill}>
                        <MessageCircleHeart size={16} color="#fff" />
                        <Text style={styles.featureText}>Easy chat</Text>
                      </View>
                    </View>
                  </>
                )}

                {view === 'forgotPassword' && (
                  <Text style={styles.subtitleText}>
                    Enter your email and we'll send you a link to get back into your account.
                  </Text>
                )}
              </Animated.View>
            </View>

            <Animated.View
              layout={Layout.springify()}
              style={[
                styles.actionArea,
                (view === 'login' || view === 'forgotPassword') && styles.loginActionArea
              ]}
            >
              {view === 'landing' ? (
                /* LANDING VIEW */
                <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.fullWidth}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => setView('login')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buttonText}>Login</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => router.push('/register')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryButtonText}>Register</Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : view === 'login' ? (
                /* LOGIN FORM VIEW */
                <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.fullWidth}>
                  <TouchableOpacity onPress={() => setView('landing')} style={styles.inlineBack}>
                    <ArrowLeft size={18} color="#fff" />
                    <Text style={styles.backLabel}>Back</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="Email address"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                  />

                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholder="Password"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      {showPassword ? <EyeOff size={20} color="#fff" /> : <Eye size={20} color="#fff" />}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.forgotPasswordLink}
                    onPress={() => setView('forgotPassword')}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Sign In</Text>}
                  </TouchableOpacity>
                </Animated.View>
              ) : (

                <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.fullWidth}>
                  <TouchableOpacity onPress={() => setView('login')} style={styles.inlineBack}>
                    <ArrowLeft size={18} color="#fff" />
                    <Text style={styles.backLabel}>Back to Login</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="Email address"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                  />

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleResetPassword}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
                  </TouchableOpacity>
                </Animated.View>
              )}

              <Text style={styles.footerText}>
                By continuing, you agree to build connections through music 🎵
              </Text>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  background: { flex: 1, backgroundColor: '#000' },
  backgroundImage: { resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  safe: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  topSection: { marginTop: 60, marginBottom: 40 },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  brandText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.8
  },
  titleText: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '800',
    marginTop: 8,
    lineHeight: 42
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 12,
    lineHeight: 24
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    flexWrap: 'wrap'
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)'
  },
  featureText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionArea: { marginTop: 'auto', alignItems: 'center', width: '100%' },

  loginActionArea: { marginTop: 10 },

  fullWidth: { width: '100%' },
  inlineBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20
  },
  backLabel: { color: '#fff', fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    marginBottom: 15, 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  passwordInput: { flex: 1, padding: 18, color: '#fff', fontSize: 16 },
  eyeIcon: { paddingRight: 18 },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  secondaryButton: {
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginTop: 12
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  footerText: {
    marginTop: 20,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center'
  },
});