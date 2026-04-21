import React, { useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function ProfileScreen({ navigation }) {
  const [fullName, setFullName] = useState('')
  const [occupation, setOccupation] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ income: 0, expenses: 0, transactions: 0 })

  useFocusEffect(
    useCallback(() => {
      fetchProfile()
    }, [])
  )

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    setEmail(session.user.email)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, sport')
      .eq('id', session.user.id)
      .single()

    if (profileData) {
      setFullName(profileData.full_name || '')
      setOccupation(profileData.sport || '')
    }

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('date', firstDay)
      .lte('date', lastDay)

    if (txData) {
      const income = txData.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const expenses = txData.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)
      setStats({ income, expenses, transactions: txData.length })
    }
  }

  const handleSave = async () => {
    if (!fullName) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing name', 'Please enter your full name.')
      return
    }

    setLoading(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, sport: occupation })
      .eq('id', session.user.id)

    setLoading(false)

    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error.message)
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Saved!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ])
    }
  }

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() }
    ])
  }

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Profile</Text>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.emailText}>{email}</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.transactions}</Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.income }]}>${formatMoney(stats.income)}</Text>
              <Text style={styles.statLabel}>Income</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.expense }]}>${formatMoney(stats.expenses)}</Text>
              <Text style={styles.statLabel}>Expenses</Text>
            </View>
          </View>

          {/* Edit fields */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal info</Text>

            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Occupation</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Student, Teacher, Engineer"
              placeholderTextColor={colors.textMuted}
              value={occupation}
              onChangeText={setOccupation}
            />

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save changes'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { padding: 24, paddingBottom: 60 },
  backBtn: { marginBottom: 8 },
  backText: { color: colors.emerald, fontSize: 15, fontWeight: '500' },
  heading: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginBottom: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 2, borderColor: colors.gold },
  avatarText: { color: colors.gold, fontSize: 28, fontWeight: '700' },
  emailText: { fontSize: 13, color: colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  statLabel: { fontSize: 10, color: colors.textSecondary },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: colors.border },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, marginTop: 8, fontWeight: '500' },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 14, fontSize: 15, color: colors.textPrimary, borderWidth: 0.5, borderColor: colors.border, marginBottom: 4 },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  logoutBtn: { backgroundColor: colors.card, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: colors.expense },
  logoutText: { color: colors.expense, fontSize: 15, fontWeight: '600' },
})