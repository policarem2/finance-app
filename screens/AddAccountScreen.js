import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import { supabase } from '../supabase'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'

const accountTypes = [
  'checking', 'savings', 'credit card',
  'cash', 'investment', 'credit line'
]

export default function AddAccountScreen({ navigation }) {
  const [name, setName] = useState('')
  const [type, setType] = useState(null)
  const [balance, setBalance] = useState('')
  const [includeInTotal, setIncludeInTotal] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!name || !type) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing fields', 'Please enter a name and select an account type.')
      return
    }

    setLoading(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { error } = await supabase.from('accounts').insert({
      user_id: session.user.id,
      name,
      type,
      balance: parseFloat(balance || 0),
      include_in_total: includeInTotal,
      currency: 'USD',
    })

    setLoading(false)

    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error.message)
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      navigation.goBack()
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.heading}>New account</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              <Text style={styles.saveText}>{loading ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Account name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Chase Checking"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={styles.label}>Account type</Text>
          <View style={styles.typeGrid}>
            {accountTypes.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, type === t && styles.typeChipActive]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setType(t)
                }}
              >
                <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Starting balance</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            value={balance}
            onChangeText={text => setBalance(text.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setIncludeInTotal(!includeInTotal)
            }}
          >
            <View>
              <Text style={styles.toggleLabel}>Include in net worth</Text>
              <Text style={styles.toggleSub}>Show this account in your total balance</Text>
            </View>
            <View style={[styles.toggle, includeInTotal && styles.toggleOn]}>
              <View style={[styles.toggleKnob, includeInTotal && styles.toggleKnobOn]} />
            </View>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  cancelText: { color: colors.textSecondary, fontSize: 15 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  saveText: { color: colors.emerald, fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.card, borderRadius: 12, padding: 16, fontSize: 15, color: colors.textPrimary, borderWidth: 0.5, borderColor: colors.border },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  typeText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', textTransform: 'capitalize' },
  typeTextActive: { color: colors.emerald },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 0.5, borderColor: colors.border },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  toggleSub: { fontSize: 12, color: colors.textSecondary },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.border, padding: 3 },
  toggleOn: { backgroundColor: colors.emerald },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleKnobOn: { transform: [{ translateX: 18 }] },
})