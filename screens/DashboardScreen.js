import React, { useState, useCallback, useRef } from 'react'
import { ScrollView, View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Animated, RefreshControl } from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const TAX_RATE = 0.30
const deductibleCategories = ['Training', 'Travel', 'Equipment', 'Medical', 'Agent fees']

const getQuarterInfo = () => {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month <= 2) return { quarter: 'Q1', due: `April 15, ${year}`, start: new Date(year, 0, 1), end: new Date(year, 2, 31) }
  if (month <= 5) return { quarter: 'Q2', due: `June 16, ${year}`, start: new Date(year, 3, 1), end: new Date(year, 5, 30) }
  if (month <= 8) return { quarter: 'Q3', due: `September 15, ${year}`, start: new Date(year, 6, 1), end: new Date(year, 8, 30) }
  return { quarter: 'Q4', due: `January 15, ${year + 1}`, start: new Date(year, 9, 1), end: new Date(year, 11, 31) }
}

export default function DashboardScreen({ navigation }) {
  const [profile, setProfile] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [quarterTransactions, setQuarterTransactions] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0)
      fetchData()
    }, [])
  )

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, sport')
        .eq('id', session.user.id)
        .single()
      setProfile(profileData)

      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date', { ascending: false })

      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', session.user.id)

      const quarterInfo = getQuarterInfo()
      const qStart = quarterInfo.start.toISOString().split('T')[0]
      const qEnd = quarterInfo.end.toISOString().split('T')[0]

      const { data: qTxData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('date', qStart)
        .lte('date', qEnd)

      setTransactions(txData || [])
      setBudgets(budgetData || [])
      setQuarterTransactions(qTxData || [])

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start()
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const balance = income - expenses
  const recentTransactions = transactions.slice(0, 3)

  const getBudgetRows = () => {
    return budgets.map(b => {
      const spent = transactions
        .filter(t => t.type === 'expense' && t.category === b.category)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0)
      return { label: b.category, spent, limit: parseFloat(b.limit_amount) }
    })
  }

  const budgetRows = getBudgetRows()
  const quarterInfo = getQuarterInfo()
  const quarterIncome = quarterTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const quarterDeductible = quarterTransactions.filter(t => t.type === 'expense' && deductibleCategories.includes(t.category)).reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const quarterTaxable = Math.max(quarterIncome - quarterDeductible, 0)
  const quarterTaxEstimate = quarterTaxable * TAX_RATE

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a78bfa"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.athleteName}>{profile ? profile.full_name : 'Loading...'}</Text>
              {profile?.sport && (
                <View style={styles.sportBadge}>
                  <Text style={styles.sportText}>{profile.sport}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                navigation.navigate('Profile')
              }}
              style={styles.profileBtn}
            >
              <View style={styles.profileAvatar}>
                <Text style={styles.profileInitials}>{initials}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Net balance — {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
            <Text style={styles.balanceAmount}>${formatMoney(balance)}</Text>
            <View style={styles.incomeExpenseRow}>
              <View>
                <Text style={styles.subLabel}>Income</Text>
                <Text style={styles.incomeText}>+${formatMoney(income)}</Text>
              </View>
              <View>
                <Text style={styles.subLabel}>Expenses</Text>
                <Text style={styles.expenseText}>-${formatMoney(expenses)}</Text>
              </View>
            </View>
          </View>
        </View>

        <Animated.View style={[styles.body, { opacity: fadeAnim }]}>

          <Text style={styles.sectionTitle}>Budget this month</Text>
          <View style={styles.card}>
            {budgetRows.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyText}>No budgets set yet</Text>
                <Text style={styles.emptySubText}>Go to the Budget tab to set your monthly limits</Text>
              </View>
            ) : (
              budgetRows.map((b, i) => {
                const pct = Math.min(b.spent / b.limit, 1)
                const over = b.spent > b.limit
                return (
                  <View key={i} style={i < budgetRows.length - 1 ? styles.budgetRowBorder : styles.budgetRow}>
                    <View style={styles.budgetLabelRow}>
                      <Text style={styles.budgetLabel}>{b.label}</Text>
                      <Text style={[styles.budgetAmount, over && styles.overBudget]}>
                        ${formatMoney(b.spent)} / ${formatMoney(b.limit)}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[
                        styles.progressFill,
                        { width: `${pct * 100}%` },
                        over ? styles.fillRed : pct > 0.8 ? styles.fillAmber : styles.fillGreen
                      ]} />
                    </View>
                  </View>
                )
              })
            )}
          </View>

          <Text style={styles.sectionTitle}>Recent transactions</Text>
          <View style={styles.card}>
            {recentTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubText}>Tap the Add tab to log your first one</Text>
              </View>
            ) : (
              recentTransactions.map((t, i) => (
                <View key={i} style={i < recentTransactions.length - 1 ? styles.txRowBorder : styles.txRow}>
                  <View style={styles.txInfo}>
                    <Text style={styles.txLabel}>{t.label}</Text>
                    <Text style={styles.txCategory}>{t.category}</Text>
                  </View>
                  <Text style={t.type === 'income' ? styles.incomeText : styles.expenseText}>
                    {t.type === 'income' ? '+' : '-'}${formatMoney(t.amount)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.navigate('Tax')
            }}
          >
            <View style={[styles.taxAlert, quarterTaxEstimate === 0 && styles.taxAlertGreen]}>
              <View style={styles.taxAlertHeader}>
                <Text style={[styles.taxTitle, quarterTaxEstimate === 0 && styles.taxTitleGreen]}>
                  {quarterInfo.quarter} estimated tax due {quarterInfo.due}
                </Text>
                <Text style={[styles.taxArrow, quarterTaxEstimate === 0 && styles.taxArrowGreen]}>→</Text>
              </View>
              <View style={styles.taxDetailsRow}>
                <View>
                  <Text style={[styles.taxSub, quarterTaxEstimate === 0 && styles.taxSubGreen]}>
                    {quarterInfo.quarter} income: ${formatMoney(quarterIncome)}
                  </Text>
                  <Text style={[styles.taxSub, quarterTaxEstimate === 0 && styles.taxSubGreen]}>
                    Deductibles: -${formatMoney(quarterDeductible)}
                  </Text>
                </View>
                <View style={styles.taxEstimateBox}>
                  <Text style={[styles.taxEstimateLabel, quarterTaxEstimate === 0 && styles.taxEstimateLabelGreen]}>Set aside</Text>
                  <Text style={[styles.taxEstimateAmount, quarterTaxEstimate === 0 && styles.taxEstimateAmountGreen]}>${formatMoney(quarterTaxEstimate)}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { backgroundColor: '#1a1a2e', padding: 24, paddingTop: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  profileBtn: { paddingTop: 4 },
  profileAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(167,139,250,0.3)', alignItems: 'center', justifyContent: 'center' },
  profileInitials: { color: '#a78bfa', fontSize: 14, fontWeight: '700' },
  welcomeText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  athleteName: { color: '#fff', fontSize: 22, fontWeight: '600' },
  sportBadge: { backgroundColor: 'rgba(167,139,250,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start' },
  sportText: { color: '#a78bfa', fontSize: 11, fontWeight: '600' },
  balanceCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 20 },
  balanceLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: '600', marginBottom: 16 },
  incomeExpenseRow: { flexDirection: 'row', gap: 32 },
  subLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 2 },
  incomeText: { color: '#4ade80', fontSize: 15, fontWeight: '600' },
  expenseText: { color: '#f87171', fontSize: 15, fontWeight: '600' },
  body: { backgroundColor: '#f2f2f7', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e', marginBottom: 10, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: '#e0e0e0' },
  budgetRow: { marginBottom: 0 },
  budgetRowBorder: { marginBottom: 14 },
  budgetLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetLabel: { fontSize: 13, color: '#444' },
  budgetAmount: { fontSize: 13, color: '#444' },
  overBudget: { color: '#f87171' },
  progressTrack: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  fillGreen: { backgroundColor: '#4ade80' },
  fillAmber: { backgroundColor: '#EF9F27' },
  fillRed: { backgroundColor: '#f87171' },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txRowBorder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderColor: '#f0f0f0', paddingBottom: 12, marginBottom: 12 },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '500', color: '#1a1a2e' },
  txCategory: { fontSize: 11, color: '#888', marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#888', marginBottom: 4 },
  emptySubText: { fontSize: 13, color: '#aaa', textAlign: 'center' },
  taxAlert: { backgroundColor: '#faeeda', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#EF9F27', marginBottom: 20 },
  taxAlertGreen: { backgroundColor: '#eaf3de', borderColor: '#4ade80' },
  taxAlertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  taxTitle: { fontSize: 13, fontWeight: '600', color: '#633806', flex: 1 },
  taxTitleGreen: { color: '#27500A' },
  taxArrow: { color: '#854F0B', fontSize: 16 },
  taxArrowGreen: { color: '#3B6D11' },
  taxDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  taxSub: { fontSize: 12, color: '#854F0B', marginBottom: 2 },
  taxSubGreen: { color: '#3B6D11' },
  taxEstimateBox: { alignItems: 'flex-end' },
  taxEstimateLabel: { fontSize: 10, color: '#854F0B', marginBottom: 2 },
  taxEstimateLabelGreen: { color: '#3B6D11' },
  taxEstimateAmount: { fontSize: 20, fontWeight: '700', color: '#633806' },
  taxEstimateAmountGreen: { color: '#27500A' },
})