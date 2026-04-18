import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Alert,
  Animated, TextInput, RefreshControl
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'

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

  const handleDelete = (transaction) => {
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
              setTransactions(prev => prev.filter(t => t.id !== transaction.id))
            }
          }
        }
      ]
    )
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

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a78bfa"
          />
        }
      >
        <Text style={styles.heading}>Transactions</Text>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or category"
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter pills */}
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

        {/* Summary row */}
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
              {search ? 'Try a different search term' : 'Tap the Add tab to log your first one'}
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
                      <View style={[styles.dot, t.type === 'income' ? styles.dotGreen : styles.dotRed]} />
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
                        <Text style={styles.editHintText}>Tap to edit</Text>
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
  safe: { flex: 1, backgroundColor: '#f2f2f7' },
  container: { padding: 24, paddingBottom: 60 },
  heading: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: '#e0e0e0', marginBottom: 12, gap: 8 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e0e0e0' },
  filterChipActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  filterText: { fontSize: 13, color: '#555', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 0.5, backgroundColor: '#e0e0e0' },
  summaryLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  summaryIncome: { fontSize: 14, fontWeight: '700', color: '#1D9E75' },
  summaryExpense: { fontSize: 14, fontWeight: '700', color: '#D85A30' },
  summaryCount: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  monthLabel: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txRowBorder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderColor: '#f0f0f0', paddingBottom: 12, marginBottom: 12 },
  txLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  dotGreen: { backgroundColor: '#4ade80' },
  dotRed: { backgroundColor: '#f87171' },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '500', color: '#1a1a2e' },
  txCategory: { fontSize: 11, color: '#888', marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  incomeText: { color: '#4ade80', fontSize: 14, fontWeight: '600' },
  expenseText: { color: '#f87171', fontSize: 14, fontWeight: '600' },
  editHint: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#f0f0f0', borderRadius: 6 },
  editHintText: { fontSize: 11, color: '#888' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#888', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#aaa', textAlign: 'center' },
})