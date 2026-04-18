import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, Animated, Alert
} from 'react-native'
import { supabase } from '../supabase'
import * as Haptics from 'expo-haptics'

export default function SignupScreen({ onSwitch }) {
  const [fullName, setFullName] = useState('')
  const [sport, setSport] = useState('')
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
        sport: sport || 'Not specified',
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
          <Animated.Text style={[styles.successTitle, { opacity: fadeAnim }]}>
            Account created!
          </Animated.Text>
          <Animated.Text style={[styles.successSubtitle, { opacity: fadeAnim }]}>
            Welcome to Athlete Finance, {fullName.split(' ')[0]}
          </Animated.Text>
          <Animated.Text style={[styles.successHint, { opacity: fadeAnim }]}>
            Taking you to sign in...
          </Animated.Text>
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
          <View style={styles.topSection}>
            <Text style={styles.appName}>Athlete Finance</Text>
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Marcus Johnson"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={fullName}
              onChangeText={setFullName}
              returnKeyType="next"
            />

            <Text style={styles.label}>Sport</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Basketball, Soccer, Tennis"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={sport}
              onChangeText={setSport}
              returnKeyType="next"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
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
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
            />

            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.3)"
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
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  flex: { flex: 1 },
  container: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  topSection: { marginBottom: 40, alignItems: 'center' },
  appName: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 8 },
  tagline: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  form: { gap: 8 },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 15, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  button: { backgroundColor: '#a78bfa', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#1a1a2e', fontSize: 16, fontWeight: '700' },
  switchBtn: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  switchText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  switchLink: { color: '#a78bfa', fontWeight: '600' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  checkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  checkMark: { color: '#fff', fontSize: 48, fontWeight: '700' },
  successTitle: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  successSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 16, marginBottom: 12 },
  successHint: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
})