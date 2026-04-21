import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Alert,
  Animated, TextInput, RefreshControl
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const filterOptions = ['All', 'Income', 'Expenses']

export default function TransactionsScreen({ navigation }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const fadeAnim = useRef(new Animated.Value(0)).current

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0)
      fetchTransactions()
    }, [])
  )

  const fetchTransactions = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })

    if (!error) setTransactions(data || [])
    setLoading(false)

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

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch =
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      activeFilter === 'All' ||
      (activeFilter === 'Income' && t.type === 'income') ||
      (activeFilter === 'Expenses' && t.type === 'expense')
    return matchesSearch && matchesFilter
  })

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
  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const totalExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.heading}>Transactions</Text>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or category..."
            placeholderTextColor={colors.textOnDarkMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, flex: 1 }}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
        }
      >
        <View style={styles.filterRow}>
          {filterOptions.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setActiveFilter(f)
              }}
            >
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredTransactions.length > 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryIncome}>+${formatMoney(totalIncome)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryExpense}>-${formatMoney(totalExpenses)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Results</Text>
              <Text style={styles.summaryCount}>{filteredTransactions.length}</Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{search ? '🔍' : '📭'}</Text>
            <Text style={styles.emptyText}>
              {search ? `No results for "${search}"` : 'No transactions yet'}
            </Text>
            <Text style={styles.emptySubText}>
              {search ? 'Try a different search term' : 'Add a transaction from any account'}
            </Text>
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
                      <View style={[styles.dot, t.type === 'income' ? styles.dotGreen : styles.dotRed, t.status === 'pending' && styles.dotPending]} />
                      <View style={styles.txInfo}>
                        <Text style={styles.txLabel}>{t.label}</Text>
                        <Text style={styles.txCategory}>{t.category} · {t.date}</Text>
                      </View>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={t.type === 'income' ? styles.incomeText : styles.expenseText}>
                        {t.type === 'income' ? '+' : '-'}${formatMoney(t.amount)}
                      </Text>
                      <View style={styles.editHint}>
                        <Text style={styles.editHintText}>Edit</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
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
  header: { backgroundColor: colors.dark, padding: 24, paddingBottom: 16 },
  heading: { color: colors.textOnDark, fontSize: 24, fontWeight: '700', marginBottom: 14 },
  searchBar: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 0.5, borderColor: colors.borderDark },
  searchInput: { fontSize: 14, color: colors.textOnDark },
  container: { padding: 20, paddingBottom: 60, backgroundColor: colors.background },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  filterText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: colors.emerald },
  summaryRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 0.5, borderColor: colors.border },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 0.5, backgroundColor: colors.border },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  summaryIncome: { fontSize: 14, fontWeight: '700', color: colors.income },
  summaryExpense: { fontSize: 14, fontWeight: '700', color: colors.expense },
  summaryCount: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
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
  txCategory: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  incomeText: { color: colors.income, fontSize: 14, fontWeight: '600' },
  expenseText: { color: colors.expense, fontSize: 14, fontWeight: '600' },
  editHint: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.background, borderRadius: 6 },
  editHintText: { fontSize: 11, color: colors.textSecondary },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  emptySubText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
})