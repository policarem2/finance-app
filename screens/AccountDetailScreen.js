import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Animated,
  RefreshControl, Alert
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const statusFilters = ['All', 'Pending', 'Cleared']

export default function AccountDetailScreen({ route, navigation }) {
  const { account } = route.params
  const [transactions, setTransactions] = useState([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [refreshing, setRefreshing] = useState(false)
  const [balance, setBalance] = useState(parseFloat(account.balance || 0))
  const fadeAnim = useRef(new Animated.Value(0)).current

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0)
      fetchTransactions()
    }, [])
  )

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', account.id)
      .order('date', { ascending: false })

    if (!error && data) {
      setTransactions(data)
      const clearedBalance = data
        .filter(t => t.status === 'cleared')
        .reduce((sum, t) => {
          if (t.type === 'income') return sum + parseFloat(t.amount)
          if (t.type === 'expense') return sum - parseFloat(t.amount)
          return sum
        }, parseFloat(account.balance || 0))
      setBalance(clearedBalance)
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start()
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchTransactions()
    setRefreshing(false)
  }

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Delete account',
      `Are you sure you want to delete "${account.name}"? All transactions will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('transactions').delete().eq('account_id', account.id)
            await supabase.from('accounts').delete().eq('id', account.id)
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            navigation.goBack()
          }
        }
      ]
    )
  }

  const filteredTransactions = transactions.filter(t => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'Pending') return t.status === 'pending'
    if (activeFilter === 'Cleared') return t.status === 'cleared'
    return true
  })

  const pendingBalance = transactions.reduce((sum, t) => {
    if (t.type === 'income') return sum + parseFloat(t.amount)
    if (t.type === 'expense') return sum - parseFloat(t.amount)
    return sum
  }, parseFloat(account.balance || 0))

  const groupByMonth = (txs) => {
    const groups = {}
    txs.forEach(t => {
      const date = new Date(t.date)
      const key = date.toLocaleString('default', { month: 'long', year: 'numeric' })
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return groups
  }

  const grouped = groupByMonth(filteredTransactions)

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.emerald}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={colors.textOnDark} />
            </TouchableOpacity>
            <Text style={styles.accountName}>{account.name}</Text>
            <TouchableOpacity onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceSection}>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Cleared balance</Text>
              <Text style={[styles.balanceAmount, balance < 0 && styles.negativeBalance]}>
                {balance < 0 ? '-' : ''}${formatMoney(Math.abs(balance))}
              </Text>
            </View>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>All transactions</Text>
              <Text style={[styles.balanceAmount, pendingBalance < 0 && styles.negativeBalance]}>
                {pendingBalance < 0 ? '-' : ''}${formatMoney(Math.abs(pendingBalance))}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Filter + Add row */}
          <View style={styles.filterAddRow}>
            <View style={styles.filterRow}>
              {statusFilters.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setActiveFilter(f)
                  }}
                >
                  <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                navigation.navigate('Main', {
                  screen: 'Add',
                  params: { accountId: account.id, accountName: account.name }
                })
              }}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Transactions */}
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubText}>Tap + to add your first transaction</Text>
            </View>
          ) : (
            Object.entries(grouped).map(([month, txs]) => (
              <View key={month}>
                <Text style={styles.monthLabel}>{month}</Text>
                <View style={styles.card}>
                  {txs.map((t, i) => (
                    <TouchableOpacity
                      key={t.id}
                      style={i < txs.length - 1 ? styles.txRowBorder : styles.txRow}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        navigation.navigate('EditTransaction', { transaction: t })
                      }}
                    >
                      <View style={styles.txLeft}>
                        <View style={[
                          styles.dot,
                          t.type === 'income' ? styles.dotGreen : styles.dotRed,
                          t.status === 'pending' && styles.dotPending
                        ]} />
                        <View style={styles.txInfo}>
                          <Text style={styles.txLabel}>{t.label}</Text>
                          <Text style={styles.txMeta}>
                            {t.category}
                            {t.payee ? ` · ${t.payee}` : ''}
                            {' · '}{t.date}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.txRight}>
                        <Text style={t.type === 'income' ? styles.incomeText : styles.expenseText}>
                          {t.type === 'income' ? '+' : '-'}${formatMoney(t.amount)}
                        </Text>
                        <View style={[
                          styles.statusBadge,
                          t.status === 'cleared' ? styles.statusCleared : styles.statusPending
                        ]}>
                          <Text style={[
                            styles.statusText,
                            t.status === 'cleared' ? styles.statusTextCleared : styles.statusTextPending
                          ]}>
                            {t.status}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  header: { backgroundColor: colors.dark, padding: 24, paddingTop: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  accountName: { color: colors.textOnDark, fontSize: 18, fontWeight: '700' },
  balanceSection: { flexDirection: 'row', gap: 12 },
  balanceCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.borderDark },
  balanceLabel: { color: colors.textOnDarkMuted, fontSize: 11, marginBottom: 4 },
  balanceAmount: { color: colors.textOnDark, fontSize: 20, fontWeight: '700' },
  negativeBalance: { color: colors.expense },
  body: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, flex: 1, minHeight: 500 },
  filterAddRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  filterRow: { flexDirection: 'row', gap: 6, flex: 1 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  filterText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: colors.emerald },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: colors.border },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txRowBorder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderColor: colors.border, paddingBottom: 12, marginBottom: 12 },
  txLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  dotGreen: { backgroundColor: colors.income },
  dotRed: { backgroundColor: colors.expense },
  dotPending: { opacity: 0.4 },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  txMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  incomeText: { color: colors.income, fontSize: 14, fontWeight: '600' },
  expenseText: { color: colors.expense, fontSize: 14, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusCleared: { backgroundColor: 'rgba(52,199,89,0.1)' },
  statusPending: { backgroundColor: 'rgba(255,149,0,0.1)' },
  statusText: { fontSize: 10, fontWeight: '600' },
  statusTextCleared: { color: colors.income },
  statusTextPending: { color: colors.pending },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  emptySubText: { fontSize: 13, color: colors.textMuted },
})