import React, { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  Animated, Platform, KeyboardAvoidingView, Alert
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'

const defaultCategories = [
  'Salary', 'Bonus', 'Endorsement', 'Prize money',
  'Housing', 'Food', 'Transport', 'Healthcare',
  'Education', 'Entertainment', 'Shopping',
  'Utilities', 'Travel', 'Equipment', 'Medical',
  'Agent fees', 'Tax payment'
]

export default function AddTransactionScreen({ route }) {
  const accountId = route?.params?.accountId || null
  const accountName = route?.params?.accountName || null

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState(null)
  const [payee, setPayee] = useState('')
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [allCategories, setAllCategories] = useState(defaultCategories)
  const [accounts, setAccounts] = useState([])
  const [transferAccountId, setTransferAccountId] = useState(null)

  const scaleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const formFadeAnim = useRef(new Animated.Value(1)).current

  useFocusEffect(
    useCallback(() => {
      fetchData()
      setSuccess(false)
      scaleAnim.setValue(0)
      fadeAnim.setValue(0)
      formFadeAnim.setValue(1)
    }, [])
  )

  const fetchData = async () => {
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

    const { data: accountData } = await supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', session.user.id)
    setAccounts(accountData || [])
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
            setLabel('')
            setAmount('')
            setPayee('')
            setType('expense')
            setCategory(null)
            setDate(new Date())
            setStatus('pending')
            setTransferAccountId(null)
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
    if (!label || !amount) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing fields', 'Please fill in description and amount.')
      return
    }

    if (type !== 'transfer' && !category) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing category', 'Please select a category.')
      return
    }

    if (type === 'transfer' && !transferAccountId) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing account', 'Please select a destination account for the transfer.')
      return
    }

    setLoading(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const { data: { user } } = await supabase.auth.getUser()

    if (type === 'transfer') {
      // Create expense in source account
      await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: accountId,
        label,
        amount: parseFloat(amount),
        type: 'expense',
        category: 'Transfer',
        payee: accounts.find(a => a.id === transferAccountId)?.name || 'Transfer',
        status,
        date: date.toISOString().split('T')[0],
        transfer_account_id: transferAccountId,
      })

      // Create income in destination account
      await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: transferAccountId,
        label,
        amount: parseFloat(amount),
        type: 'income',
        category: 'Transfer',
        payee: accounts.find(a => a.id === accountId)?.name || accountName || 'Transfer',
        status,
        date: date.toISOString().split('T')[0],
        transfer_account_id: accountId,
      })
    } else {
      await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: accountId,
        label,
        amount: parseFloat(amount),
        type,
        category,
        payee,
        status,
        date: date.toISOString().split('T')[0],
      })
    }

    setLoading(false)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    showSuccessAnimation()
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
          <Text style={styles.successTitle}>
            {type === 'transfer' ? 'Transfer complete!' : 'Transaction saved!'}
          </Text>
          <Text style={styles.successSub}>
            {type === 'transfer'
              ? 'Both accounts have been updated'
              : 'Your transaction has been recorded'
            }
          </Text>
        </Animated.View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>Add transaction</Text>
          {accountName && (
            <View style={styles.accountBadge}>
              <Text style={styles.accountBadgeText}>→ {accountName}</Text>
            </View>
          )}
        </View>

        <Animated.ScrollView
          contentContainerStyle={styles.container}
          style={{ opacity: formFadeAnim, flex: 1 }}
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

          {/* Amount */}
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Grocery run"
            placeholderTextColor={colors.textMuted}
            value={label}
            onChangeText={setLabel}
          />

          {/* Payee — hide for transfers */}
          {type !== 'transfer' && (
            <>
              <Text style={styles.label}>Payee <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Whole Foods"
                placeholderTextColor={colors.textMuted}
                value={payee}
                onChangeText={setPayee}
              />
            </>
          )}

          {/* Date */}
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

          {/* Status */}
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

          {/* Transfer destination account */}
          {type === 'transfer' && (
            <>
              <Text style={styles.label}>To account</Text>
              {accounts.filter(a => a.id !== accountId).length === 0 ? (
                <View style={styles.noAccountsBox}>
                  <Text style={styles.noAccountsText}>You need at least 2 accounts to make a transfer.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
                  {accounts
                    .filter(a => a.id !== accountId)
                    .map(a => (
                      <TouchableOpacity
                        key={a.id}
                        style={[styles.accountChip, transferAccountId === a.id && styles.accountChipActive]}
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setTransferAccountId(a.id)
                        }}
                      >
                        <Text style={[styles.accountChipText, transferAccountId === a.id && styles.accountChipTextActive]}>
                          {a.name}
                        </Text>
                        <Text style={[styles.accountChipType, transferAccountId === a.id && styles.accountChipTypeActive]}>
                          {a.type}
                        </Text>
                      </TouchableOpacity>
                    ))
                  }
                </ScrollView>
              )}
            </>
          )}

          {/* Category picker — hide for transfers */}
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

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveBtnText}>
              {loading ? 'Saving...' : type === 'transfer' ? 'Complete transfer' : 'Save transaction'}
            </Text>
          </TouchableOpacity>

        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  flex: { flex: 1 },
  header: { backgroundColor: colors.dark, padding: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: colors.textOnDark, fontSize: 24, fontWeight: '700' },
  accountBadge: { backgroundColor: colors.emeraldLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5, borderColor: colors.emerald },
  accountBadgeText: { color: colors.emerald, fontSize: 12, fontWeight: '600' },
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
  accountScroll: { marginBottom: 8 },
  accountChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, marginRight: 10, alignItems: 'center', minWidth: 100 },
  accountChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  accountChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  accountChipTextActive: { color: colors.emerald },
  accountChipType: { fontSize: 10, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  accountChipTypeActive: { color: 'rgba(255,255,255,0.4)' },
  noAccountsBox: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.border, marginBottom: 8 },
  noAccountsText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  categoryChipCustom: { borderColor: colors.emerald },
  categoryChipCustomActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  categoryText: { fontSize: 13, color: colors.textSecondary },
  categoryTextActive: { color: colors.emerald },
  customTag: { fontSize: 9, color: colors.emerald, fontWeight: '600' },
  customTagActive: { color: 'rgba(255,255,255,0.7)' },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: 12, padding: 18, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  checkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  checkMark: { color: '#fff', fontSize: 48, fontWeight: '700' },
  successTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 8 },
  successSub: { color: colors.textSecondary, fontSize: 14 },
})