import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, Animated, Alert
} from 'react-native'
import { supabase } from '../supabase'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'

export default function SignupScreen({ onSwitch }) {
  const [fullName, setFullName] = useState('')
  const [occupation, setOccupation] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const scaleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  const showSuccessAnimation = () => {
    setSuccess(true)
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        onSwitch()
      }, 2000)
    })
  }

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }

    if (password !== confirmPassword) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Password mismatch', 'Your passwords do not match.')
      return
    }

    if (password.length < 6) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Weak password', 'Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Signup failed', error.message)
      setLoading(false)
      return
    }

    if (data?.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        sport: occupation || 'Not specified',
      })
    }

    setLoading(false)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    showSuccessAnimation()
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.successContainer, { opacity: fadeAnim }]}>
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.checkMark}>✓</Text>
          </Animated.View>
          <Text style={styles.successTitle}>Welcome to Clutch!</Text>
          <Text style={styles.successSubtitle}>{fullName.split(' ')[0]}, your account is ready</Text>
          <Text style={styles.successHint}>Taking you to sign in...</Text>
        </Animated.View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>C</Text>
            </View>
            <Text style={styles.appName}>CLUTCH</Text>
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Jane Smith"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
              returnKeyType="next"
            />

            <Text style={styles.label}>Occupation <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Student, Teacher, Engineer"
              placeholderTextColor={colors.textMuted}
              value={occupation}
              onChangeText={setOccupation}
              returnKeyType="next"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
            />

            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating account...' : 'Create account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchBtn}
              onPress={onSwitch}
            >
              <Text style={styles.switchText}>
                Already have an account?{' '}
                <Text style={styles.switchLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  flex: { flex: 1 },
  container: { padding: 24, paddingTop: 40, paddingBottom: 60 },
  logoSection: { alignItems: 'center', marginBottom: 36 },
  logoCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1.5, borderColor: colors.gold },
  logoText: { color: colors.gold, fontSize: 36, fontWeight: '800', fontStyle: 'italic' },
  appName: { color: colors.textOnDark, fontSize: 26, fontWeight: '800', letterSpacing: 6, marginBottom: 6 },
  tagline: { color: colors.textOnDarkMuted, fontSize: 13 },
  form: { gap: 8 },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4, marginTop: 8, fontWeight: '500' },
  optional: { fontWeight: '400', color: colors.textMuted },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, color: colors.textOnDark, fontSize: 15, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' },
  button: { backgroundColor: colors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.dark, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  switchBtn: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  switchText: { color: colors.textOnDarkMuted, fontSize: 14 },
  switchLink: { color: colors.gold, fontWeight: '600' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  checkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  checkMark: { color: colors.dark, fontSize: 48, fontWeight: '700' },
  successTitle: { color: colors.textOnDark, fontSize: 28, fontWeight: '700', marginBottom: 8 },
  successSubtitle: { color: colors.textOnDarkMuted, fontSize: 16, marginBottom: 12 },
  successHint: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
})