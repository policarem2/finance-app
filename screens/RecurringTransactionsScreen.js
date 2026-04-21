import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  Alert, Animated, RefreshControl, Platform
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const frequencies = ['daily', 'weekly', 'monthly', 'yearly']

const defaultCategories = [
  'Salary', 'Bonus', 'Housing', 'Food', 'Transport',
  'Healthcare', 'Education', 'Entertainment', 'Shopping',
  'Utilities', 'Travel', 'Equipment', 'Medical',
  'Agent fees', 'Tax payment'
]

export default function RecurringTransactionsScreen({ navigation }) {
  const [recurring, setRecurring] = useState([])
  const [accounts, setAccounts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Form state
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState(null)
  const [payee, setPayee] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [accountId, setAccountId] = useState(null)
  const [startDate, setStartDate] = useState(new Date())
  const [endDate, setEndDate] = useState(null)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [loading, setLoading] = useState(false)

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0)
      fetchData()
    }, [])
  )

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: recurringData } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    const { data: accountData } = await supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', session.user.id)

    setRecurring(recurringData || [])
    setAccounts(accountData || [])
    if (accountData?.length > 0 && !accountId) {
      setAccountId(accountData[0].id)
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start()
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleSave = async () => {
    if (!label || !amount || !category || !accountId) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing fields', 'Please fill in all required fields.')
      return
    }

    setLoading(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { error } = await supabase.from('recurring_transactions').insert({
      user_id: session.user.id,
      account_id: accountId,
      label,
      amount: parseFloat(amount),
      type,
      category,
      payee,
      frequency,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate ? endDate.toISOString().split('T')[0] : null,
      last_processed: null,
    })

    setLoading(false)

    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error.message)
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setShowForm(false)
      resetForm()
      fetchData()
    }
  }

  const resetForm = () => {
    setLabel('')
    setAmount('')
    setType('expense')
    setCategory(null)
    setPayee('')
    setFrequency('monthly')
    setStartDate(new Date())
    setEndDate(null)
  }

  const handleDelete = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Delete recurring transaction',
      `Delete "${item.label}"? This won't delete past transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('recurring_transactions').delete().eq('id', item.id)
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            fetchData()
          }
        }
      ]
    )
  }

  const handleProcessToDate = async (item) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const today = new Date()
    const lastProcessed = item.last_processed ? new Date(item.last_processed) : new Date(item.start_date)
    const endDateLimit = item.end_date ? new Date(item.end_date) : today

    const datesToProcess = []
    let current = new Date(lastProcessed)

    while (current <= Math.min(today, endDateLimit)) {
      const next = new Date(current)
      if (item.frequency === 'daily') next.setDate(next.getDate() + 1)
      else if (item.frequency === 'weekly') next.setDate(next.getDate() + 7)
      else if (item.frequency === 'monthly') next.setMonth(next.getMonth() + 1)
      else if (item.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1)

      if (next <= Math.min(today, endDateLimit)) {
        datesToProcess.push(next.toISOString().split('T')[0])
      }
      current = next
    }

    if (datesToProcess.length === 0) {
      Alert.alert('Up to date', 'No new transactions to process.')
      return
    }

    Alert.alert(
      'Process to date',
      `This will create ${datesToProcess.length} transaction${datesToProcess.length > 1 ? 's' : ''} for "${item.label}". Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: async () => {
            setProcessing(true)

            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return

            const transactions = datesToProcess.map(date => ({
              user_id: session.user.id,
              account_id: item.account_id,
              label: item.label,
              amount: item.amount,
              type: item.type,
              category: item.category,
              payee: item.payee,
              status: 'cleared',
              date,
            }))

            const { error } = await supabase.from('transactions').insert(transactions)

            if (!error) {
              await supabase
                .from('recurring_transactions')
                .update({ last_processed: datesToProcess[datesToProcess.length - 1] })
                .eq('id', item.id)

              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              Alert.alert('Done!', `${datesToProcess.length} transaction${datesToProcess.length > 1 ? 's' : ''} added successfully.`)
              fetchData()
            } else {
              Alert.alert('Error', error.message)
            }

            setProcessing(false)
          }
        }
      ]
    )
  }

  const getAccountName = (id) => {
    const account = accounts.find(a => a.id === id)
    return account?.name || 'Unknown account'
  }

  const formatDate = (d) => {
    if (!d) return 'No end date'
    return new Date(d).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const incomeCategories = ['Salary', 'Bonus']
  const categoriesToShow = type === 'income' ? incomeCategories : defaultCategories.filter(c => !incomeCategories.includes(c))

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Recurring</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowForm(!showForm)
          }}
        >
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ New'}</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
        }
      >
        {/* Add form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New recurring transaction</Text>

            {/* Type toggle */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, type === 'expense' && styles.toggleActiveExpense]}
                onPress={() => setType('expense')}
              >
                <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, type === 'income' && styles.toggleActiveIncome]}
                onPress={() => setType('income')}
              >
                <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>Income</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Netflix subscription"
              placeholderTextColor={colors.textMuted}
              value={label}
              onChangeText={setLabel}
            />

            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={text => setAmount(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Payee <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Netflix"
              placeholderTextColor={colors.textMuted}
              value={payee}
              onChangeText={setPayee}
            />

            <Text style={styles.label}>Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {accounts.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.chip, accountId === a.id && styles.chipActive]}
                  onPress={() => setAccountId(a.id)}
                >
                  <Text style={[styles.chipText, accountId === a.id && styles.chipTextActive]}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Frequency</Text>
            <View style={styles.freqRow}>
              {frequencies.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, frequency === f && styles.chipActive]}
                  onPress={() => setFrequency(f)}
                >
                  <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Start date</Text>
            <TouchableOpacity
              style={styles.datePicker}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={styles.dateText}>{formatDate(startDate)}</Text>
              <Text style={styles.dateIcon}>📅</Text>
            </TouchableOpacity>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowStartPicker(false)
                  if (selectedDate) setStartDate(selectedDate)
                }}
              />
            )}

            <Text style={styles.label}>End date <Text style={styles.optional}>(optional)</Text></Text>
            <TouchableOpacity
              style={styles.datePicker}
              onPress={() => setShowEndPicker(true)}
            >
              <Text style={[styles.dateText, !endDate && { color: colors.textMuted }]}>
                {endDate ? formatDate(endDate) : 'No end date'}
              </Text>
              <Text style={styles.dateIcon}>📅</Text>
            </TouchableOpacity>

            {endDate && (
              <TouchableOpacity onPress={() => setEndDate(null)}>
                <Text style={styles.clearDate}>Clear end date</Text>
              </TouchableOpacity>
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={startDate}
                onChange={(event, selectedDate) => {
                  setShowEndPicker(false)
                  if (selectedDate) setEndDate(selectedDate)
                }}
              />
            )}

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {categoriesToShow.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save recurring transaction'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recurring list */}
        {recurring.length === 0 && !showForm ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔁</Text>
            <Text style={styles.emptyText}>No recurring transactions</Text>
            <Text style={styles.emptySubText}>Tap + New to set up a recurring transaction like rent, salary or subscriptions</Text>
          </View>
        ) : (
          recurring.map((item, i) => (
            <View key={item.id} style={styles.recurringCard}>
              <View style={styles.recurringHeader}>
                <View style={styles.recurringLeft}>
                  <View style={[styles.typeDot, item.type === 'income' ? styles.dotIncome : styles.dotExpense]} />
                  <View>
                    <Text style={styles.recurringLabel}>{item.label}</Text>
                    <Text style={styles.recurringMeta}>
                      {item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)} · {getAccountName(item.account_id)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.recurringAmount, item.type === 'income' ? styles.incomeText : styles.expenseText]}>
                  {item.type === 'income' ? '+' : '-'}${formatMoney(item.amount)}
                </Text>
              </View>

              <View style={styles.recurringDetails}>
                <Text style={styles.recurringDetailText}>
                  Start: {formatDate(item.start_date)}
                  {item.end_date ? ` · End: ${formatDate(item.end_date)}` : ' · No end date'}
                </Text>
                {item.last_processed && (
                  <Text style={styles.recurringDetailText}>Last processed: {formatDate(item.last_processed)}</Text>
                )}
                {item.payee && (
                  <Text style={styles.recurringDetailText}>Payee: {item.payee}</Text>
                )}
              </View>

              <View style={styles.recurringActions}>
                <TouchableOpacity
                  style={styles.processBtn}
                  onPress={() => handleProcessToDate(item)}
                  disabled={processing}
                >
                  <Ionicons name="play-outline" size={14} color={colors.emerald} />
                  <Text style={styles.processBtnText}>Process to date</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteRecurringBtn}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={styles.deleteRecurringText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  header: { backgroundColor: colors.dark, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16 },
  backText: { color: colors.emerald, fontSize: 15, fontWeight: '500' },
  heading: { color: colors.textOnDark, fontSize: 18, fontWeight: '700' },
  addBtn: { backgroundColor: colors.emerald, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  container: { padding: 20, paddingBottom: 60, backgroundColor: colors.background },
  formCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: colors.border },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  toggleActiveExpense: { backgroundColor: colors.expense },
  toggleActiveIncome: { backgroundColor: colors.income },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 12 },
  optional: { fontWeight: '400', color: colors.textMuted },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 14, fontSize: 15, color: colors.textPrimary, borderWidth: 0.5, borderColor: colors.border },
  chipScroll: { marginBottom: 4 },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border, marginRight: 8, marginBottom: 4 },
  chipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.emerald },
  datePicker: { backgroundColor: colors.background, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 15, color: colors.textPrimary },
  dateIcon: { fontSize: 16 },
  clearDate: { color: colors.expense, fontSize: 13, marginTop: 6 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border },
  categoryChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  categoryText: { fontSize: 12, color: colors.textSecondary },
  categoryTextActive: { color: colors.emerald },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  recurringCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  recurringHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  recurringLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  typeDot: { width: 10, height: 10, borderRadius: 5 },
  dotIncome: { backgroundColor: colors.income },
  dotExpense: { backgroundColor: colors.expense },
  recurringLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  recurringMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  recurringAmount: { fontSize: 16, fontWeight: '700' },
  incomeText: { color: colors.income },
  expenseText: { color: colors.expense },
  recurringDetails: { backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 12 },
  recurringDetailText: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  recurringActions: { flexDirection: 'row', gap: 10 },
  processBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.emeraldLight, borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: colors.emerald },
  processBtnText: { color: colors.emerald, fontSize: 13, fontWeight: '600' },
  deleteRecurringBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10, borderWidth: 0.5, borderColor: colors.expense, alignItems: 'center', justifyContent: 'center' },
  deleteRecurringText: { color: colors.expense, fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  emptySubText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
})