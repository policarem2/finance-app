import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native'
import { supabase } from '../supabase'
import * as Haptics from 'expo-haptics'
import SignupScreen from './SignupScreen'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSignup, setShowSignup] = useState(false)

  if (showSignup) {
    return <SignupScreen onSwitch={() => setShowSignup(false)} />
  }

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError(error.message)
    }
    setLoading(false)
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
            <Text style={styles.tagline}>Track your money. Focus on your game.</Text>
          </View>

          <View style={styles.form}>
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
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#1a1a2e" />
                : <Text style={styles.buttonText}>Sign in</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => setShowSignup(true)}
            >
              <Text style={styles.switchText}>
                Don't have an account?{' '}
                <Text style={styles.switchLink}>Sign up</Text>
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
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', paddingBottom: 60 },
  topSection: { marginBottom: 48, alignItems: 'center' },
  appName: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 8 },
  tagline: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' },
  form: { gap: 8 },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 15, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  errorText: { color: '#f87171', fontSize: 13, marginTop: 4 },
  button: { backgroundColor: '#a78bfa', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#1a1a2e', fontSize: 16, fontWeight: '700' },
  switchBtn: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  switchText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  switchLink: { color: '#a78bfa', fontWeight: '600' },
})