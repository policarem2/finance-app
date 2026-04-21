import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '../supabase'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'

const defaultCategories = [
  'Salary', 'Bonus', 'Endorsement', 'Prize money',
  'Housing', 'Food', 'Transport', 'Healthcare',
  'Education', 'Entertainment', 'Shopping',
  'Utilities', 'Travel', 'Equipment', 'Medical',
  'Agent fees', 'Tax payment'
]

export default function EditTransactionScreen({ route, navigation }) {
  const { transaction } = route.params

  const [label, setLabel] = useState(transaction.label)
  const [amount, setAmount] = useState(transaction.amount.toString())
  const [type, setType] = useState(transaction.type)
  const [category, setCategory] = useState(transaction.category)
  const [payee, setPayee] = useState(transaction.payee || '')
  const [status, setStatus] = useState(transaction.status || 'pending')
  const [date, setDate] = useState(new Date(transaction.date))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [allCategories, setAllCategories] = useState(defaultCategories)

  useEffect(() => {
    fetchCustomCategories()
  }, [])

  const fetchCustomCategories = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: budgetData } = await supabase
      .from('budgets')
      .select('category')
      .eq('user_id', session.user.id)

    if (budgetData) {
      const customCats = budgetData
        .map(b => b.category)
        .filter(cat => !defaultCategories.includes(cat))
      setAllCategories([...defaultCategories, ...customCats])
    }
  }

  const handleAmountChange = (text) => {
    const cleaned = text.replace(/[^0-9.]/g, '')
    setAmount(cleaned)
  }

  const handleSave = async () => {
    if (!label || !amount || !category) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }

    setLoading(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const { error } = await supabase
      .from('transactions')
      .update({
        label,
        amount: parseFloat(amount),
        type,
        category,
        payee,
        status,
        date: date.toISOString().split('T')[0],
      })
      .eq('id', transaction.id)

    setLoading(false)

    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error.message)
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Updated!', 'Transaction has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ])
    }
  }

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Delete transaction',
      `Are you sure you want to delete "${transaction.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('transactions')
              .delete()
              .eq('id', transaction.id)

            if (error) {
              Alert.alert('Error', error.message)
            } else {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              navigation.goBack()
            }
          }
        }
      ]
    )
  }

  const formatDate = (d) => {
    return d.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const incomeCategories = ['Salary', 'Bonus', 'Endorsement', 'Prize money']
  const expenseCategories = allCategories.filter(c => !incomeCategories.includes(c))
  const customCategories = allCategories.filter(c => !defaultCategories.includes(c))
  const categoriesToShow = type === 'income'
    ? incomeCategories
    : [...expenseCategories, ...customCategories.filter(c => !expenseCategories.includes(c))]

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Edit transaction</Text>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'expense' && styles.toggleActiveExpense]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setType('expense')
              }}
            >
              <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'income' && styles.toggleActiveIncome]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setType('income')
              }}
            >
              <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'transfer' && styles.toggleActiveTransfer]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setType('transfer')
              }}
            >
              <Text style={[styles.toggleText, type === 'transfer' && styles.toggleTextActive]}>Transfer</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Grocery run"
            placeholderTextColor={colors.textMuted}
            value={label}
            onChangeText={setLabel}
          />

          <Text style={styles.label}>Payee <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Whole Foods"
            placeholderTextColor={colors.textMuted}
            value={payee}
            onChangeText={setPayee}
          />

          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.datePicker}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowDatePicker(true)
            }}
          >
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            <Text style={styles.dateIcon}>📅</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios')
                if (selectedDate) setDate(selectedDate)
                if (Platform.OS !== 'ios') setShowDatePicker(false)
              }}
            />
          )}

          <Text style={styles.label}>Status</Text>
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[styles.statusChip, status === 'pending' && styles.statusChipPending]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setStatus('pending')
              }}
            >
              <Text style={[styles.statusText, status === 'pending' && styles.statusTextPending]}>Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusChip, status === 'cleared' && styles.statusChipCleared]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setStatus('cleared')
              }}
            >
              <Text style={[styles.statusText, status === 'cleared' && styles.statusTextCleared]}>Cleared</Text>
            </TouchableOpacity>
          </View>

          {type !== 'transfer' && (
            <>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {categoriesToShow.map((cat) => {
                  const isCustom = !defaultCategories.includes(cat)
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        category === cat && styles.categoryChipActive,
                        isCustom && styles.categoryChipCustom,
                        category === cat && isCustom && styles.categoryChipCustomActive,
                      ]}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setCategory(cat)
                      }}
                    >
                      <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                        {cat}
                      </Text>
                      {isCustom && (
                        <Text style={[styles.customTag, category === cat && styles.customTagActive]}>
                          custom
                        </Text>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save changes</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  flex: { flex: 1 },
  header: { backgroundColor: colors.dark, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16 },
  backText: { color: colors.emerald, fontSize: 15, fontWeight: '500' },
  heading: { fontSize: 17, fontWeight: '700', color: colors.textOnDark },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,59,48,0.15)', borderRadius: 8, borderWidth: 0.5, borderColor: colors.expense },
  deleteText: { color: colors.expense, fontSize: 13, fontWeight: '600' },
  container: { padding: 20, paddingBottom: 60, backgroundColor: colors.background },
  toggleRow: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  toggleActiveExpense: { backgroundColor: colors.expense },
  toggleActiveIncome: { backgroundColor: colors.income },
  toggleActiveTransfer: { backgroundColor: '#60a5fa' },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 8 },
  optional: { fontWeight: '400', color: colors.textMuted },
  input: { backgroundColor: colors.card, borderRadius: 12, padding: 16, fontSize: 15, color: colors.textPrimary, borderWidth: 0.5, borderColor: colors.border, marginBottom: 4 },
  datePicker: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dateText: { fontSize: 15, color: colors.textPrimary },
  dateIcon: { fontSize: 16 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statusChip: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center' },
  statusChipPending: { backgroundColor: colors.goldLight, borderColor: colors.gold },
  statusChipCleared: { backgroundColor: colors.emeraldLight, borderColor: colors.emerald },
  statusText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  statusTextPending: { color: '#7a5c1e' },
  statusTextCleared: { color: colors.emerald },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  categoryChipCustom: { borderColor: colors.emerald },
  categoryChipCustomActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  categoryText: { fontSize: 13, color: colors.textSecondary },
  categoryTextActive: { color: colors.emerald },
  customTag: { fontSize: 9, color: colors.emerald, fontWeight: '600' },
  customTagActive: { color: 'rgba(255,255,255,0.7)' },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})