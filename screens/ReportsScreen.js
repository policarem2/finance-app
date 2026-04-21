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
import { colors } from '../theme'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const BAR_WIDTH = 28
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const deductibleCategories = ['Training', 'Travel', 'Equipment', 'Medical', 'Agent fees', 'Healthcare', 'Education']
const TAX_RATE = 0.30

const views = ['Overview', 'Breakdown', 'Accounts', 'Payee']

export default function ReportsScreen() {
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [profile, setProfile] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [view, setView] = useState('Overview')
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

    const { data: accountData } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', session.user.id)

    setTransactions(txData || [])
    setAccounts(accountData || [])

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
      csv += `CLUTCH FINANCE REPORT - ${year}\n`
      csv += `Name,${profile?.full_name || ''}\n`
      csv += `Export Date,${now.toLocaleDateString()}\n\n`

      csv += `ANNUAL SUMMARY\n`
      csv += `Total Income,$${totalIncome.toFixed(2)}\n`
      csv += `Total Expenses,$${totalExpenses.toFixed(2)}\n`
      csv += `Net Balance,$${(totalIncome - totalExpenses).toFixed(2)}\n`
      csv += `Total Deductibles,$${totalDeductible.toFixed(2)}\n`
      csv += `Taxable Income,$${taxableIncome.toFixed(2)}\n`
      csv += `Estimated Tax (30%),$${estimatedTax.toFixed(2)}\n\n`

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

      csv += `ALL TRANSACTIONS\n`
      csv += `Date,Description,Category,Type,Status,Amount\n`
      transactions.forEach(t => {
        const label = t.label.includes(',') ? `"${t.label}"` : t.label
        csv += `${t.date},${label},${t.category},${t.type === 'income' ? 'Income' : 'Expense'},${t.status},$${parseFloat(t.amount).toFixed(2)}\n`
      })

      const fileName = `${profile?.full_name?.replace(' ', '_') || 'Clutch'}_Finance_${year}.csv`
      const fileUri = FileSystem.documentDirectory + fileName
      await FileSystem.writeAsStringAsync(fileUri, csv)

      const isAvailable = await Sharing.isAvailableAsync()
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Clutch Finance Report ${year}`,
          UTI: 'public.comma-separated-values-text',
        })
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      Alert.alert('Export failed', error.message || 'Something went wrong.')
    }

    setExporting(false)
  }

  // ── Overview data ──
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

  // ── Breakdown data ──
  const categoryBreakdown = () => {
    const cats = {}
    selectedTx.filter(t => t.type === 'expense').forEach(t => {
      if (!cats[t.category]) cats[t.category] = 0
      cats[t.category] += parseFloat(t.amount)
    })
    return Object.entries(cats).sort((a, b) => b[1] - a[1])
  }

  const categories = categoryBreakdown()
  const totalCatExpenses = categories.reduce((sum, [, v]) => sum + v, 0)

  // ── Accounts report data ──
  const getAccountReport = () => {
    return accounts.map(account => {
      const accountTx = transactions.filter(t => t.account_id === account.id)
      const income = accountTx.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const expenses = accountTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const txCount = accountTx.length

      const catBreakdown = {}
      accountTx.filter(t => t.type === 'expense').forEach(t => {
        if (!catBreakdown[t.category]) catBreakdown[t.category] = 0
        catBreakdown[t.category] += parseFloat(t.amount)
      })
      const topCategory = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1])[0]

      return { ...account, income, expenses, txCount, topCategory }
    }).sort((a, b) => b.expenses - a.expenses)
  }

  const accountReport = getAccountReport()

  // ── Payee report data ──
  const getPayeeReport = () => {
    const payees = {}
    transactions
      .filter(t => t.payee && t.payee.trim() !== '' && t.type === 'expense')
      .forEach(t => {
        if (!payees[t.payee]) payees[t.payee] = { total: 0, count: 0, category: t.category }
        payees[t.payee].total += parseFloat(t.amount)
        payees[t.payee].count += 1
      })
    return Object.entries(payees)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 20)
  }

  const payeeReport = getPayeeReport()
  const totalPayeeSpending = payeeReport.reduce((sum, [, v]) => sum + v.total, 0)

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
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

        {/* View toggle */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
        >
          {views.map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.tab, view === v && styles.tabActive]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setView(v)
              }}
            >
              <Text style={[styles.tabText, view === v && styles.tabTextActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.container}
        style={{ opacity: fadeAnim, flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
        }
      >

        {/* ── OVERVIEW ── */}
        {view === 'Overview' && (
          <>
            <Text style={styles.sectionTitle}>Income vs expenses — {new Date().getFullYear()}</Text>
            <View style={styles.card}>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
                  <Text style={styles.legendText}>Income</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
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
                          <View style={[styles.bar, { height: incomeHeight, backgroundColor: colors.income, opacity: isSelected ? 1 : 0.4 }]} />
                          <View style={[styles.bar, { height: expenseHeight, backgroundColor: colors.expense, opacity: isSelected ? 1 : 0.4 }]} />
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
                  <Text style={[styles.summaryValue, { color: colors.income }]}>${formatMoney(selectedIncome)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text style={[styles.summaryValue, { color: colors.expense }]}>${formatMoney(selectedExpenses)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.summaryWide, { backgroundColor: selectedBalance >= 0 ? colors.emerald : colors.expense }]}>
                  <Text style={styles.summaryLabelLight}>Net balance</Text>
                  <Text style={styles.summaryValueLight}>
                    {selectedBalance >= 0 ? '+' : '-'}${formatMoney(Math.abs(selectedBalance))}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* ── BREAKDOWN ── */}
        {view === 'Breakdown' && (
          <>
            <Text style={styles.sectionTitle}>Spending by category</Text>

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
                  const pct = totalCatExpenses > 0 ? (amount / totalCatExpenses) * 100 : 0
                  return (
                    <View key={cat} style={i < categories.length - 1 ? styles.rowBorder : styles.row}>
                      <View style={styles.rowInfo}>
                        <View style={styles.rowLabelRow}>
                          <Text style={styles.rowLabel}>{cat}</Text>
                          <Text style={styles.rowAmount}>${formatMoney(amount)}</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.rowSub}>{Math.round(pct)}% of expenses</Text>
                      </View>
                    </View>
                  )
                })
              )}
              {categories.length > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total expenses</Text>
                  <Text style={styles.totalAmount}>${formatMoney(totalCatExpenses)}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── ACCOUNTS REPORT ── */}
        {view === 'Accounts' && (
          <>
            <Text style={styles.sectionTitle}>Account report — {new Date().getFullYear()}</Text>

            {accountReport.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏦</Text>
                <Text style={styles.emptyText}>No accounts found</Text>
                <Text style={styles.emptySubText}>Add accounts to see your account report</Text>
              </View>
            ) : (
              <>
                {/* Total summary */}
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total income</Text>
                    <Text style={[styles.summaryValue, { color: colors.income }]}>
                      ${formatMoney(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0))}
                    </Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total expenses</Text>
                    <Text style={[styles.summaryValue, { color: colors.expense }]}>
                      ${formatMoney(transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0))}
                    </Text>
                  </View>
                </View>

                {/* Per account */}
                {accountReport.map(account => {
                  const net = account.income - account.expenses
                  const totalExp = accountReport.reduce((sum, a) => sum + a.expenses, 0)
                  const pct = totalExp > 0 ? (account.expenses / totalExp) * 100 : 0

                  return (
                    <View key={account.id} style={styles.accountReportCard}>
                      <View style={styles.accountReportHeader}>
                        <View>
                          <Text style={styles.accountReportName}>{account.name}</Text>
                          <Text style={styles.accountReportType}>{account.type} · {account.txCount} transaction{account.txCount !== 1 ? 's' : ''}</Text>
                        </View>
                        <View style={styles.accountReportBalance}>
                          <Text style={[styles.accountReportNet, net >= 0 ? { color: colors.income } : { color: colors.expense }]}>
                            {net >= 0 ? '+' : '-'}${formatMoney(Math.abs(net))}
                          </Text>
                          <Text style={styles.accountReportNetLabel}>net</Text>
                        </View>
                      </View>

                      <View style={styles.accountReportStats}>
                        <View style={styles.accountStatItem}>
                          <Text style={styles.accountStatLabel}>Income</Text>
                          <Text style={[styles.accountStatValue, { color: colors.income }]}>+${formatMoney(account.income)}</Text>
                        </View>
                        <View style={styles.accountStatDivider} />
                        <View style={styles.accountStatItem}>
                          <Text style={styles.accountStatLabel}>Expenses</Text>
                          <Text style={[styles.accountStatValue, { color: colors.expense }]}>-${formatMoney(account.expenses)}</Text>
                        </View>
                        <View style={styles.accountStatDivider} />
                        <View style={styles.accountStatItem}>
                          <Text style={styles.accountStatLabel}>Top category</Text>
                          <Text style={styles.accountStatValue} numberOfLines={1}>
                            {account.topCategory ? account.topCategory[0] : '—'}
                          </Text>
                        </View>
                      </View>

                      {account.expenses > 0 && (
                        <>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFillExpense, { width: `${Math.min(pct, 100)}%` }]} />
                          </View>
                          <Text style={styles.rowSub}>{Math.round(pct)}% of total spending</Text>
                        </>
                      )}
                    </View>
                  )
                })}
              </>
            )}
          </>
        )}

        {/* ── PAYEE REPORT ── */}
        {view === 'Payee' && (
          <>
            <Text style={styles.sectionTitle}>Top payees — {new Date().getFullYear()}</Text>

            {payeeReport.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👤</Text>
                <Text style={styles.emptyText}>No payees found</Text>
                <Text style={styles.emptySubText}>Add a payee when logging transactions to see this report</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {payeeReport.map(([payee, data], i) => {
                  const pct = totalPayeeSpending > 0 ? (data.total / totalPayeeSpending) * 100 : 0
                  return (
                    <View key={payee} style={i < payeeReport.length - 1 ? styles.rowBorder : styles.row}>
                      <View style={styles.rowInfo}>
                        <View style={styles.rowLabelRow}>
                          <View style={styles.payeeLeft}>
                            <View style={styles.payeeAvatar}>
                              <Text style={styles.payeeAvatarText}>
                                {payee.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.rowLabel}>{payee}</Text>
                              <Text style={styles.payeeSub}>
                                {data.count} transaction{data.count !== 1 ? 's' : ''} · {data.category}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.rowAmount}>${formatMoney(data.total)}</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.rowSub}>{Math.round(pct)}% of payee spending</Text>
                      </View>
                    </View>
                  )
                })}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total payee spending</Text>
                  <Text style={styles.totalAmount}>${formatMoney(totalPayeeSpending)}</Text>
                </View>
              </View>
            )}
          </>
        )}

      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  header: { backgroundColor: colors.dark, padding: 24, paddingBottom: 0 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { color: colors.textOnDark, fontSize: 24, fontWeight: '700' },
  exportBtn: { backgroundColor: colors.emerald, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, minWidth: 100, alignItems: 'center' },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabScroll: { marginBottom: 0 },
  tab: { paddingHorizontal: 18, paddingVertical: 10, marginRight: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.emerald },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textOnDarkMuted },
  tabTextActive: { color: colors.emerald },
  container: { padding: 20, paddingBottom: 60, backgroundColor: colors.background },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: colors.border },
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.textSecondary },
  chart: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 4, gap: 8 },
  barGroup: { alignItems: 'center', width: BAR_WIDTH * 2 + 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 120 },
  bar: { width: BAR_WIDTH, borderRadius: 4 },
  barLabel: { fontSize: 10, color: colors.textMuted, marginTop: 6 },
  barLabelSelected: { color: colors.textPrimary, fontWeight: '600' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  summaryCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, width: '47%', borderWidth: 0.5, borderColor: colors.border },
  summaryWide: { width: '100%' },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  summaryLabelLight: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  summaryValueLight: { fontSize: 20, fontWeight: '700', color: '#fff' },
  monthScroll: { marginBottom: 12 },
  monthChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, marginRight: 8 },
  monthChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  monthChipText: { fontSize: 13, color: colors.textSecondary },
  monthChipTextActive: { color: colors.emerald },
  row: { marginBottom: 0 },
  rowBorder: { marginBottom: 14 },
  rowInfo: { flex: 1 },
  rowLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowLabel: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, flex: 1 },
  rowAmount: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.emerald },
  progressFillExpense: { height: 6, borderRadius: 3, backgroundColor: colors.expense },
  totalRow: { borderTopWidth: 0.5, borderColor: colors.border, marginTop: 12, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  totalAmount: { fontSize: 13, fontWeight: '700', color: colors.expense },
  accountReportCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  accountReportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  accountReportName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  accountReportType: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
  accountReportBalance: { alignItems: 'flex-end' },
  accountReportNet: { fontSize: 18, fontWeight: '700' },
  accountReportNetLabel: { fontSize: 11, color: colors.textMuted },
  accountReportStats: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 12 },
  accountStatItem: { flex: 1, alignItems: 'center' },
  accountStatDivider: { width: 0.5, backgroundColor: colors.border },
  accountStatLabel: { fontSize: 10, color: colors.textSecondary, marginBottom: 4 },
  accountStatValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  payeeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  payeeAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.emeraldLight, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: colors.emerald },
  payeeAvatarText: { color: colors.emerald, fontSize: 15, fontWeight: '700' },
  payeeSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  emptySubText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
})