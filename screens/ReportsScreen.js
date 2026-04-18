import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Animated,
  RefreshControl, Alert, ActivityIndicator
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const BAR_WIDTH = 28
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const deductibleCategories = ['Training', 'Travel', 'Equipment', 'Medical', 'Agent fees']
const TAX_RATE = 0.30

export default function ReportsScreen() {
  const [transactions, setTransactions] = useState([])
  const [profile, setProfile] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [view, setView] = useState('overview')
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0)
      fetchData()
    }, [])
  )

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, sport')
      .eq('id', session.user.id)
      .single()
    setProfile(profileData)

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false })

    setTransactions(txData || [])

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

  const handleExport = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setExporting(true)

    try {
      const now = new Date()
      const year = now.getFullYear()

      const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const totalDeductible = transactions.filter(t => t.type === 'expense' && deductibleCategories.includes(t.category)).reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const taxableIncome = Math.max(totalIncome - totalDeductible, 0)
      const estimatedTax = taxableIncome * TAX_RATE

      let csv = ''

      // Section 1 - Athlete Info
      csv += `ATHLETE FINANCE REPORT - ${year}\n`
      csv += `Athlete Name,${profile?.full_name || ''}\n`
      csv += `Sport,${profile?.sport || ''}\n`
      csv += `Export Date,${now.toLocaleDateString()}\n`
      csv += `\n`

      // Section 2 - Annual Summary
      csv += `ANNUAL SUMMARY\n`
      csv += `Total Income,$${totalIncome.toFixed(2)}\n`
      csv += `Total Expenses,$${totalExpenses.toFixed(2)}\n`
      csv += `Net Balance,$${(totalIncome - totalExpenses).toFixed(2)}\n`
      csv += `Total Deductibles,$${totalDeductible.toFixed(2)}\n`
      csv += `Taxable Income,$${taxableIncome.toFixed(2)}\n`
      csv += `Estimated Tax (30%),$${estimatedTax.toFixed(2)}\n`
      csv += `\n`

      // Section 3 - Monthly Summary
      csv += `MONTHLY SUMMARY\n`
      csv += `Month,Income,Expenses,Net Balance,Deductibles,Taxable Income,Est Tax (30%)\n`
      months.forEach((m, i) => {
        const monthTx = transactions.filter(t => new Date(t.date).getMonth() === i)
        const mIncome = monthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
        const mExpenses = monthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)
        const mDeductible = monthTx.filter(t => t.type === 'expense' && deductibleCategories.includes(t.category)).reduce((sum, t) => sum + parseFloat(t.amount), 0)
        const mTaxable = Math.max(mIncome - mDeductible, 0)
        csv += `${m} ${year},$${mIncome.toFixed(2)},$${mExpenses.toFixed(2)},$${(mIncome - mExpenses).toFixed(2)},$${mDeductible.toFixed(2)},$${mTaxable.toFixed(2)},$${(mTaxable * TAX_RATE).toFixed(2)}\n`
      })
      csv += `\n`

      // Section 4 - All Transactions
      csv += `ALL TRANSACTIONS\n`
      csv += `Date,Description,Category,Type,Amount\n`
      transactions.forEach(t => {
        const label = t.label.includes(',') ? `"${t.label}"` : t.label
        csv += `${t.date},${label},${t.category},${t.type === 'income' ? 'Income' : 'Expense'},$${parseFloat(t.amount).toFixed(2)}\n`
      })
      csv += `\n`

      // Section 5 - Deductible Expenses
      csv += `DEDUCTIBLE EXPENSES\n`
      csv += `Date,Description,Category,Amount\n`
      const deductibleTx = transactions.filter(t => t.type === 'expense' && deductibleCategories.includes(t.category))
      if (deductibleTx.length === 0) {
        csv += `No deductible expenses found\n`
      } else {
        deductibleTx.forEach(t => {
          const label = t.label.includes(',') ? `"${t.label}"` : t.label
          csv += `${t.date},${label},${t.category},$${parseFloat(t.amount).toFixed(2)}\n`
        })
      }

      const fileName = `${profile?.full_name?.replace(' ', '_') || 'Athlete'}_Finance_${year}.csv`
      const fileUri = FileSystem.documentDirectory + fileName

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: 'utf8',
      })

      const isAvailable = await Sharing.isAvailableAsync()
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `${profile?.full_name || 'Athlete'} Finance Report ${year}`,
          UTI: 'public.comma-separated-values-text',
        })
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        Alert.alert('Sharing not available', 'Your device does not support file sharing.')
      }

    } catch (error) {
      console.log('Export error:', error.message)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Export failed', error.message || 'Something went wrong.')
    }

    setExporting(false)
  }

  const getMonthlyTotals = () => {
    return months.map((m, i) => {
      const monthTx = transactions.filter(t => new Date(t.date).getMonth() === i)
      const income = monthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const expenses = monthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)
      return { month: m, income, expenses }
    })
  }

  const monthlyTotals = getMonthlyTotals()
  const maxValue = Math.max(...monthlyTotals.map(m => Math.max(m.income, m.expenses)), 1)
  const selectedTx = transactions.filter(t => new Date(t.date).getMonth() === selectedMonth)
  const selectedIncome = selectedTx.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const selectedExpenses = selectedTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const selectedBalance = selectedIncome - selectedExpenses

  const categoryBreakdown = () => {
    const cats = {}
    selectedTx.filter(t => t.type === 'expense').forEach(t => {
      if (!cats[t.category]) cats[t.category] = 0
      cats[t.category] += parseFloat(t.amount)
    })
    return Object.entries(cats).sort((a, b) => b[1] - a[1])
  }

  const categories = categoryBreakdown()
  const totalExpenses = categories.reduce((sum, [, v]) => sum + v, 0)

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        contentContainerStyle={styles.container}
        style={{ opacity: fadeAnim }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />
        }
      >
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Reports</Text>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.exportBtnText}>Export .csv</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'overview' && styles.toggleActive]}
            onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setView('overview') }}
          >
            <Text style={[styles.toggleText, view === 'overview' && styles.toggleTextActive]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'breakdown' && styles.toggleActive]}
            onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setView('breakdown') }}
          >
            <Text style={[styles.toggleText, view === 'breakdown' && styles.toggleTextActive]}>Breakdown</Text>
          </TouchableOpacity>
        </View>

        {view === 'overview' ? (
          <>
            <Text style={styles.sectionTitle}>Income vs expenses — {new Date().getFullYear()}</Text>
            <View style={styles.card}>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#4ade80' }]} />
                  <Text style={styles.legendText}>Income</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#f87171' }]} />
                  <Text style={styles.legendText}>Expenses</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chart}>
                  {monthlyTotals.map((m, i) => {
                    const incomeHeight = Math.max((m.income / maxValue) * 120, 2)
                    const expenseHeight = Math.max((m.expenses / maxValue) * 120, 2)
                    const isSelected = i === selectedMonth
                    return (
                      <TouchableOpacity
                        key={i}
                        style={styles.barGroup}
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setSelectedMonth(i)
                        }}
                      >
                        <View style={styles.bars}>
                          <View style={[styles.bar, { height: incomeHeight, backgroundColor: '#4ade80', opacity: isSelected ? 1 : 0.5 }]} />
                          <View style={[styles.bar, { height: expenseHeight, backgroundColor: '#f87171', opacity: isSelected ? 1 : 0.5 }]} />
                        </View>
                        <Text style={[styles.barLabel, isSelected && styles.barLabelSelected]}>{m.month}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </ScrollView>
            </View>

            <Text style={styles.sectionTitle}>{months[selectedMonth]} summary</Text>
            {selectedTx.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>No data for {months[selectedMonth]}</Text>
                <Text style={styles.emptySubText}>Add transactions to see your monthly summary</Text>
              </View>
            ) : (
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Income</Text>
                  <Text style={[styles.summaryValue, styles.greenText]}>${formatMoney(selectedIncome)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text style={[styles.summaryValue, styles.redText]}>${formatMoney(selectedExpenses)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.summaryWide, selectedBalance >= 0 ? styles.summaryGreen : styles.summaryRed]}>
                  <Text style={styles.summaryLabelLight}>Net balance</Text>
                  <Text style={styles.summaryValueLight}>
                    {selectedBalance >= 0 ? '+' : '-'}${formatMoney(Math.abs(selectedBalance))}
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Spending by category — {months[selectedMonth]}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
              {months.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.monthChip, selectedMonth === i && styles.monthChipActive]}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedMonth(i)
                  }}
                >
                  <Text style={[styles.monthChipText, selectedMonth === i && styles.monthChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.card}>
              {categories.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🗂️</Text>
                  <Text style={styles.emptyText}>No expenses in {months[selectedMonth]}</Text>
                  <Text style={styles.emptySubText}>Add expense transactions to see a breakdown</Text>
                </View>
              ) : (
                categories.map(([cat, amount], i) => {
                  const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                  return (
                    <View key={cat} style={i < categories.length - 1 ? styles.catRowBorder : styles.catRow}>
                      <View style={styles.catInfo}>
                        <View style={styles.catLabelRow}>
                          <Text style={styles.catName}>{cat}</Text>
                          <Text style={styles.catAmount}>${formatMoney(amount)}</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.catPct}>{Math.round(pct)}% of expenses</Text>
                      </View>
                    </View>
                  )
                })
              )}
              {categories.length > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total expenses</Text>
                  <Text style={styles.totalAmount}>${formatMoney(totalExpenses)}</Text>
                </View>
              )}
            </View>
          </>
        )}

      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f2f7' },
  container: { padding: 24, paddingBottom: 60 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading: { fontSize: 24, fontWeight: '700', color: '#1a1a2e' },
  exportBtn: { backgroundColor: '#1a1a2e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, minWidth: 100, alignItems: 'center' },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', backgroundColor: '#e0e0e0', borderRadius: 12, padding: 4, marginBottom: 24 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  toggleActive: { backgroundColor: '#1a1a2e' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
  toggleTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: '#e0e0e0' },
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#888' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 4, gap: 8 },
  barGroup: { alignItems: 'center', width: BAR_WIDTH * 2 + 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 120 },
  bar: { width: BAR_WIDTH, borderRadius: 4 },
  barLabel: { fontSize: 10, color: '#aaa', marginTop: 6 },
  barLabelSelected: { color: '#1a1a2e', fontWeight: '600' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, width: '47%', borderWidth: 0.5, borderColor: '#e0e0e0' },
  summaryWide: { width: '100%' },
  summaryGreen: { backgroundColor: '#1D9E75' },
  summaryRed: { backgroundColor: '#D85A30' },
  summaryLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  summaryLabelLight: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
  summaryValueLight: { fontSize: 20, fontWeight: '700', color: '#fff' },
  greenText: { color: '#1D9E75' },
  redText: { color: '#D85A30' },
  monthScroll: { marginBottom: 12 },
  monthChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e0e0e0', marginRight: 8 },
  monthChipActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  monthChipText: { fontSize: 13, color: '#555' },
  monthChipTextActive: { color: '#fff' },
  catRow: { marginBottom: 0 },
  catRowBorder: { marginBottom: 14 },
  catInfo: { flex: 1 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { fontSize: 13, fontWeight: '500', color: '#1a1a2e' },
  catAmount: { fontSize: 13, color: '#444' },
  progressTrack: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, marginBottom: 4 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#a78bfa' },
  catPct: { fontSize: 11, color: '#aaa' },
  totalRow: { borderTopWidth: 0.5, borderColor: '#f0f0f0', marginTop: 12, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  totalAmount: { fontSize: 13, fontWeight: '700', color: '#f87171' },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#888', marginBottom: 4 },
  emptySubText: { fontSize: 13, color: '#aaa', textAlign: 'center' },
})