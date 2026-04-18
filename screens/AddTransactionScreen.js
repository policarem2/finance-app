import React, { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  Animated, Platform
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'

const defaultCategories = [
  'Salary', 'Bonus', 'Endorsement', 'Prize money',
  'Training', 'Travel', 'Equipment', 'Medical',
  'Agent fees', 'Tax payment'
]

export default function AddTransactionScreen() {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState(null)
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [allCategories, setAllCategories] = useState(defaultCategories)

  const scaleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const formFadeAnim = useRef(new Animated.Value(1)).current

  useFocusEffect(
    useCallback(() => {
      fetchCustomCategories()
      setSuccess(false)
      scaleAnim.setValue(0)
      fadeAnim.setValue(0)
      formFadeAnim.setValue(1)
    }, [])
  )

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

  const showSuccessAnimation = () => {
    Animated.timing(formFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
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
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setSuccess(false)
            scaleAnim.setValue(0)
            formFadeAnim.setValue(1)
          })
        }, 1800)
      })
    })
  }

  const handleAmountChange = (text) => {
    const cleaned = text.replace(/[^0-9.]/g, '')
    setAmount(cleaned)
  }

  const handleSave = async () => {
    if (!label || !amount || !category) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    setLoading(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      label,
      amount: parseFloat(amount),
      type,
      category,
      date: date.toISOString().split('T')[0],
    })

    setLoading(false)

    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setLabel('')
      setAmount('')
      setType('expense')
      setCategory(null)
      setDate(new Date())
      showSuccessAnimation()
    }
  }

  const handleTypeToggle = async (newType) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setType(newType)
  }

  const handleCategorySelect = async (cat) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCategory(cat)
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

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.successContainer, { opacity: fadeAnim }]}>
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.checkMark}>✓</Text>
          </Animated.View>
          <Text style={styles.successTitle}>Transaction saved!</Text>
          <Text style={styles.successSub}>Your transaction has been recorded</Text>
        </Animated.View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        contentContainerStyle={styles.container}
        style={{ opacity: formFadeAnim }}
      >
        <Text style={styles.heading}>Add transaction</Text>

        {/* Income / Expense toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, type === 'expense' && styles.toggleActive]}
            onPress={() => handleTypeToggle('expense')}
          >
            <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, type === 'income' && styles.toggleActiveGreen]}
            onPress={() => handleTypeToggle('income')}
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
              if (selectedDate) {
                setDate(selectedDate)
              }
              if (Platform.OS !== 'ios') {
                setShowDatePicker(false)
              }
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
                onPress={() => handleCategorySelect(cat)}
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
          <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save transaction'}</Text>
        </TouchableOpacity>

      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f2f7' },
  container: { padding: 24, paddingBottom: 60 },
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
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f2f2f7' },
  checkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#4ade80', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  checkMark: { color: '#fff', fontSize: 48, fontWeight: '700' },
  successTitle: { color: '#1a1a2e', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  successSub: { color: '#888', fontSize: 14 },
})