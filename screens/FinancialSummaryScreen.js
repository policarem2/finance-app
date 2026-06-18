import React, { useState, useCallback, useRef } from 'react'
import {
  ScrollView, View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Animated, RefreshControl, ActivityIndicator
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'
import { Ionicons } from '@expo/vector-icons'

const ANTHROPIC_API_KEY = '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'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const TAX_RATE = 0.30
const deductibleCategories = ['Training', 'Travel', 'Equipment', 'Medical', 'Agent fees', 'Healthcare', 'Education']

const getQuarterInfo = () => {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month <= 2) return { quarter: 'Q1', due: `April 15, ${year}`, start: new Date(year, 0, 1), end: new Date(year, 2, 31) }
  if (month <= 5) return { quarter: 'Q2', due: `June 16, ${year}`, start: new Date(year, 3, 1), end: new Date(year, 5, 30) }
  if (month <= 8) return { quarter: 'Q3', due: `September 15, ${year}`, start: new Date(year, 6, 1), end: new Date(year, 8, 30) }
  return { quarter: 'Q4', due: `January 15, ${year + 1}`, start: new Date(year, 9, 1), end: new Date(year, 11, 31) }
}

const fetchAIInsights = async ({ profile, income, expenses, balance, budgetRows, quarterTaxEstimate, quarterIncome, transactions }) => {
  const monthName = new Date().toLocaleString('default', { month: 'long' })

  const categoryBreakdown = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount)
      return acc
    }, {})

  const topCategories = Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `${cat}: $${amt.toFixed(2)}`)
    .join(', ')

  const overBudgetCategories = budgetRows
    .filter(b => b.spent > b.limit)
    .map(b => `${b.label} (spent $${b.spent.toFixed(2)} vs $${b.limit.toFixed(2)} limit)`)
    .join(', ')

  const prompt = `You are a smart financial coach inside Clutch, a personal finance app for individuals and students managing their own money.

Here is ${profile?.full_name || 'the user'}'s financial snapshot for ${monthName}:
- Occupation: ${profile?.sport || 'Not specified'}
- Monthly income: $${income.toFixed(2)}
- Monthly expenses: $${expenses.toFixed(2)}
- Net balance: $${balance.toFixed(2)}
- Top spending categories: ${topCategories || 'No expenses yet'}
- Over-budget categories: ${overBudgetCategories || 'None'}
- Quarterly tax estimate: $${quarterTaxEstimate.toFixed(2)} (based on $${quarterIncome.toFixed(2)} quarterly income)

Generate exactly 2-3 personalized financial insight cards. Each insight should:
1. Be specific to their actual numbers — never generic
2. Reference real categories, percentages, or dollar amounts from their data
3. Be direct and conversational — like a smart friend, not a bank

Respond ONLY with a valid JSON array and nothing else — no markdown, no backticks, no explanation.

The JSON must be an array of objects with exactly these fields:
[
  {
    "emoji": string (a single relevant emoji),
    "headline": string (max 8 words, punchy and specific),
    "insight": string (2-3 sentences, specific to their numbers, actionable),
    "cta": string or null (optional short action label like "Talk to an advisor" or "Review budget"),
    "ctaTarget": string or null ("Resources" or "Budget" or null)
  }
]

If income is $0 or there are no transactions, generate 2 motivational onboarding insights encouraging them to log their first transactions and set budgets. Always return valid JSON.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()

  if (data?.content?.[0]?.text) {
    const raw = data.content[0].text
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  }

  throw new Error('No content returned from AI')
}

const InsightCard = ({ card, onCta, index }) => {
  const slideAnim = useRef(new Animated.Value(30)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 120,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[
      styles.insightCard,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <View style={styles.insightTop}>
        <Text style={styles.insightEmoji}>{card.emoji}</Text>
        <Text style={styles.insightHeadline}>{card.headline}</Text>
      </View>
      <Text style={styles.insightText}>{card.insight}</Text>
      {card.cta && card.ctaTarget && (
        <TouchableOpacity
          style={styles.insightCta}
          onPress={() => onCta(card.ctaTarget)}
        >
          <Text style={styles.insightCtaText}>{card.cta} →</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

const InsightSkeleton = () => {
  const pulseAnim = useRef(new Animated.Value(0.4)).current

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return (
    <Animated.View style={[styles.skeletonCard, { opacity: pulseAnim }]}>
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonCircle} />
        <View style={styles.skeletonLine} />
      </View>
      <View style={[styles.skeletonBlock, { width: '100%', marginTop: 12 }]} />
      <View style={[styles.skeletonBlock, { width: '75%', marginTop: 6 }]} />
    </Animated.View>
  )
}

export default function FinancialSummaryScreen({ navigation }) {
  const [profile, setProfile] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [quarterTransactions, setQuarterTransactions] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [insights, setInsights] = useState([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0)
      fetchData()
    }, [])
  )

  const fetchData = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.user) {
        console.log('Session error:', sessionError)
        return
      }

      const userId = session.user.id

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, sport')
        .eq('id', userId)
        .single()

      if (profileError) console.log('Profile error:', profileError.message)
      setProfile(profileData)

      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date', { ascending: false })

      if (txError) console.log('Transactions error:', txError.message)

      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)

      if (budgetError) console.log('Budget error:', budgetError.message)

      const quarterInfo = getQuarterInfo()
      const qStart = quarterInfo.start.toISOString().split('T')[0]
      const qEnd = quarterInfo.end.toISOString().split('T')[0]

      const { data: qTxData, error: qTxError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', qStart)
        .lte('date', qEnd)

      if (qTxError) console.log('Quarter tx error:', qTxError.message)

      const txList = txData || []
      const budgetList = budgetData || []
      const qTxList = qTxData || []

      setTransactions(txList)
      setBudgets(budgetList)
      setQuarterTransactions(qTxList)

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start()

      loadInsights({ profileData, txList, budgetList, qTxList })

    } catch (err) {
      console.log('fetchData error:', err.message)
    }
  }

  const loadInsights = async ({ profileData, txList, budgetList, qTxList }) => {
    setInsightsLoading(true)
    setInsightsError(false)

    try {
      const inc = txList.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0)
      const exp = txList.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0)
      const bal = inc - exp

      const bRows = budgetList.map(b => {
        const spent = txList
          .filter(t => t.type === 'expense' && t.category === b.category)
          .reduce((s, t) => s + parseFloat(t.amount), 0)
        return { label: b.category, spent, limit: parseFloat(b.limit_amount) }
      })

      const qInc = qTxList.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0)
      const qDeduct = qTxList
        .filter(t => t.type === 'expense' && deductibleCategories.includes(t.category))
        .reduce((s, t) => s + parseFloat(t.amount), 0)
      const qTaxEst = Math.max(qInc - qDeduct, 0) * TAX_RATE

      const result = await fetchAIInsights({
        profile: profileData,
        income: inc,
        expenses: exp,
        balance: bal,
        budgetRows: bRows,
        quarterTaxEstimate: qTaxEst,
        quarterIncome: qInc,
        transactions: txList,
      })

      setInsights(result)
    } catch (err) {
      console.log('Insights error:', err.message)
      setInsightsError(true)
    } finally {
      setInsightsLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleInsightCta = async (target) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (target === 'Resources') navigation.navigate('Resources')
    if (target === 'Budget') navigation.navigate('Budget')
  }

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0)
  const balance = income - expenses
  const recentTransactions = transactions.slice(0, 3)

  const budgetRows = budgets.map(b => {
    const spent = transactions
      .filter(t => t.type === 'expense' && t.category === b.category)
      .reduce((s, t) => s + parseFloat(t.amount), 0)
    return { label: b.category, spent, limit: parseFloat(b.limit_amount) }
  })

  const quarterInfo = getQuarterInfo()
  const quarterIncome = quarterTransactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0)
  const quarterDeductible = quarterTransactions
    .filter(t => t.type === 'expense' && deductibleCategories.includes(t.category))
    .reduce((s, t) => s + parseFloat(t.amount), 0)
  const quarterTaxable = Math.max(quarterIncome - quarterDeductible, 0)
  const quarterTaxEstimate = quarterTaxable * TAX_RATE

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>

            {/* Back button + name */}
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={22} color={colors.textOnDark} />
              </TouchableOpacity>
              <View>
                <Text style={styles.welcomeText}>Financial summary</Text>
                <Text style={styles.athleteName}>
                  {profile ? profile.full_name : '—'}
                </Text>
                {profile?.sport && (
                  <View style={styles.sportBadge}>
                    <Text style={styles.sportText}>{profile.sport}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Profile avatar */}
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

          {/* Balance card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>
              Net balance — {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
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

          {/* AI Coach Insights */}
          <View style={styles.insightsSectionHeader}>
            <View style={styles.insightsBadge}>
              <Text style={styles.insightsBadgeText}>AI COACH</Text>
            </View>
            <Text style={styles.insightsSectionTitle}>Your money, right now</Text>
          </View>

          {insightsLoading ? (
            <>
              <InsightSkeleton />
              <InsightSkeleton />
            </>
          ) : insightsError ? (
            <View style={styles.insightsErrorCard}>
              <Text style={styles.insightsErrorIcon}>🔄</Text>
              <Text style={styles.insightsErrorText}>Couldn't load insights</Text>
              <TouchableOpacity
                onPress={() => loadInsights({
                  profileData: profile,
                  txList: transactions,
                  budgetList: budgets,
                  qTxList: quarterTransactions,
                })}
              >
                <Text style={styles.insightsRetryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            insights.map((card, i) => (
              <InsightCard
                key={i}
                card={card}
                index={i}
                onCta={handleInsightCta}
              />
            ))
          )}

          {/* Budget this month */}
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

          {/* Recent transactions */}
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

          {/* Tax widget */}
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
                  <Text style={[styles.taxEstimateLabel, quarterTaxEstimate === 0 && styles.taxEstimateLabelGreen]}>
                    Set aside
                  </Text>
                  <Text style={[styles.taxEstimateAmount, quarterTaxEstimate === 0 && styles.taxEstimateAmountGreen]}>
                    ${formatMoney(quarterTaxEstimate)}
                  </Text>
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
  safe: { flex: 1, backgroundColor: colors.dark },
  header: { backgroundColor: colors.dark, padding: 24, paddingTop: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  backBtn: { marginTop: 2, marginRight: 4 },
  profileBtn: { paddingTop: 4 },
  profileAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.gold },
  profileInitials: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  welcomeText: { color: colors.textOnDarkMuted, fontSize: 13 },
  athleteName: { color: colors.textOnDark, fontSize: 22, fontWeight: '600' },
  sportBadge: { backgroundColor: colors.emeraldLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: colors.emerald },
  sportText: { color: colors.emerald, fontSize: 11, fontWeight: '600' },
  balanceCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: colors.borderDark },
  balanceLabel: { color: colors.textOnDarkMuted, fontSize: 12, marginBottom: 4 },
  balanceAmount: { color: colors.textOnDark, fontSize: 32, fontWeight: '700', marginBottom: 16 },
  incomeExpenseRow: { flexDirection: 'row', gap: 32 },
  subLabel: { color: colors.textOnDarkMuted, fontSize: 11, marginBottom: 2 },
  incomeText: { color: colors.income, fontSize: 15, fontWeight: '600' },
  expenseText: { color: colors.expense, fontSize: 15, fontWeight: '600' },
  body: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 10, marginTop: 4 },
  insightsSectionHeader: { marginBottom: 12, marginTop: 4 },
  insightsBadge: { backgroundColor: colors.dark, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  insightsBadgeText: { color: colors.emerald, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  insightsSectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  insightCard: { backgroundColor: colors.dark, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(16,137,129,0.3)' },
  insightTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  insightEmoji: { fontSize: 22 },
  insightHeadline: { fontSize: 15, fontWeight: '700', color: '#fff', flex: 1, lineHeight: 20 },
  insightText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },
  insightCta: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: colors.emeraldLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: colors.emerald },
  insightCtaText: { color: colors.emerald, fontSize: 12, fontWeight: '600' },
  skeletonCard: { backgroundColor: colors.card, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skeletonCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border },
  skeletonLine: { height: 14, width: '55%', backgroundColor: colors.border, borderRadius: 6 },
  skeletonBlock: { height: 12, backgroundColor: colors.border, borderRadius: 6 },
  insightsErrorCard: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  insightsErrorIcon: { fontSize: 28, marginBottom: 8 },
  insightsErrorText: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
  insightsRetryText: { fontSize: 13, color: colors.emerald, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: colors.border },
  budgetRow: { marginBottom: 0 },
  budgetRowBorder: { marginBottom: 14 },
  budgetLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetLabel: { fontSize: 13, color: colors.textSecondary },
  budgetAmount: { fontSize: 13, color: colors.textSecondary },
  overBudget: { color: colors.expense },
  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  fillGreen: { backgroundColor: colors.income },
  fillAmber: { backgroundColor: colors.gold },
  fillRed: { backgroundColor: colors.expense },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txRowBorder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderColor: colors.border, paddingBottom: 12, marginBottom: 12 },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  txCategory: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  emptySubText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  taxAlert: { backgroundColor: colors.goldLight, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.gold, marginBottom: 20 },
  taxAlertGreen: { backgroundColor: 'rgba(52,199,89,0.08)', borderColor: colors.income },
  taxAlertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  taxTitle: { fontSize: 13, fontWeight: '600', color: '#854F0B', flex: 1 },
  taxTitleGreen: { color: '#1a6b2a' },
  taxArrow: { color: '#854F0B', fontSize: 16 },
  taxArrowGreen: { color: '#1a6b2a' },
  taxDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  taxSub: { fontSize: 12, color: '#854F0B', marginBottom: 2 },
  taxSubGreen: { color: '#1a6b2a' },
  taxEstimateBox: { alignItems: 'flex-end' },
  taxEstimateLabel: { fontSize: 10, color: '#854F0B', marginBottom: 2 },
  taxEstimateLabelGreen: { color: '#1a6b2a' },
  taxEstimateAmount: { fontSize: 20, fontWeight: '700', color: '#633806' },
  taxEstimateAmountGreen: { color: '#1a6b2a' },
})