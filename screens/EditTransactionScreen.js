import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '../supabase'
import * as Haptics from 'expo-haptics'

const defaultCategories = [
  'Salary', 'Bonus', 'Endorsement', 'Prize money',
  'Training', 'Travel', 'Equipment', 'Medical',
  'Agent fees', 'Tax payment'
]

export default function EditTransactionScreen({ route, navigation }) {
  const { transaction } = route.params

  const [label, setLabel] = useState(transaction.label)
  const [amount, setAmount] = useState(transaction.amount.toString())
  const [type, setType] = useState(transaction.type)
  const [category, setCategory] = useState(transaction.category)
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
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heading}>Edit transaction</Text>

          {/* Income / Expense toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'expense' && styles.toggleActive]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setType('expense')
              }}
            >
              <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'income' && styles.toggleActiveGreen]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setType('income')
              }}
            >
              <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>Income</Text>
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor="#aaa"
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Flight to Miami"
            placeholderTextColor="#aaa"
            value={label}
            onChangeText={setLabel}
          />

          {/* Date picker */}
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

          {/* Category picker */}
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

          {/* Save button */}
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
  safe: { flex: 1, backgroundColor: '#f2f2f7' },
  flex: { flex: 1 },
  container: { padding: 24, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backText: { color: '#a78bfa', fontSize: 15, fontWeight: '500' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff0f0', borderRadius: 8, borderWidth: 0.5, borderColor: '#f87171' },
  deleteText: { color: '#f87171', fontSize: 13, fontWeight: '600' },
  heading: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 24 },
  toggleRow: { flexDirection: 'row', backgroundColor: '#e0e0e0', borderRadius: 12, padding: 4, marginBottom: 24 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  toggleActive: { backgroundColor: '#f87171' },
  toggleActiveGreen: { backgroundColor: '#4ade80' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 15, color: '#1a1a2e', borderWidth: 0.5, borderColor: '#e0e0e0', marginBottom: 8 },
  datePicker: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#e0e0e0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dateText: { fontSize: 15, color: '#1a1a2e' },
  dateIcon: { fontSize: 16 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryChipActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  categoryChipCustom: { borderColor: '#a78bfa', borderStyle: 'dashed' },
  categoryChipCustomActive: { backgroundColor: '#534AB7', borderColor: '#534AB7' },
  categoryText: { fontSize: 13, color: '#555' },
  categoryTextActive: { color: '#fff' },
  customTag: { fontSize: 9, color: '#a78bfa', fontWeight: '600' },
  customTagActive: { color: 'rgba(255,255,255,0.6)' },
  saveBtn: { backgroundColor: '#a78bfa', borderRadius: 12, padding: 18, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})