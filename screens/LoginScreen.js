import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Image
} from 'react-native'
import { supabase } from '../supabase'
import * as Haptics from 'expo-haptics'
import SignupScreen from './SignupScreen'
import { colors } from '../theme'

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
          {/* Logo section */}
          <View style={styles.logoSection}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Form */}
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
                ? <ActivityIndicator color={colors.dark} />
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
  safe: { flex: 1, backgroundColor: colors.dark },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: -150,
  },
  logo: { width: 680, height: 550, marginBottom: 8 },
  tagline: { color: colors.textOnDarkMuted, fontSize: 13, letterSpacing: 0.5 },
  form: { gap: 8 },
  label: { color: colors.textOnDarkSub, fontSize: 13, marginBottom: 4, marginTop: 8, fontWeight: '500' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 16,
    color: colors.textOnDark,
    fontSize: 15,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  errorText: { color: colors.expense, fontSize: 13, marginTop: 4 },
  button: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  switchBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  switchText: { color: colors.textOnDarkMuted, fontSize: 14 },
  switchLink: { color: colors.gold, fontWeight: '600' },
})