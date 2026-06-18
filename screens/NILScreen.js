import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Animated,
  RefreshControl
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const FEDERAL_TAX_RATE = 0.30
const SE_TAX_RATE = 0.153

const NIL_TYPES = [
  { key: 'sponsorship', label: 'Sponsorship', icon: 'megaphone-outline', color: '#60a5fa' },
  { key: 'endorsement', label: 'Endorsement', icon: 'ribbon-outline', color: colors.gold },
  { key: 'appearance', label: 'Appearance fee', icon: 'people-outline', color: '#a78bfa' },
  { key: 'prize', label: 'Prize money', icon: 'trophy-outline', color: colors.income },
  { key: 'social_media', label: 'Social media', icon: 'phone-portrait-outline', color: '#f472b6' },
  { key: 'licensing', label: 'Licensing', icon: 'document-text-outline', color: colors.emerald },
  { key: 'other', label: 'Other NIL', icon: 'cash-outline', color: colors.textSecondary },
]

const getQuarterDates = () => {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month <= 2) return { label: 'Q1', start: new Date(year, 0, 1), end: new Date(year, 2, 31), due: `April 15, ${year}` }
  if (month <= 5) return { label: 'Q2', start: new Date(year, 3, 1), end: new Date(year, 5, 30), due: `June 16, ${year}` }
  if (month <= 8) return { label: 'Q3', start: new Date(year, 6, 1), end: new Date(year, 8, 30), due: `September 15, ${year}` }
  return { label: 'Q4', start: new Date(year, 9, 1), end: new Date(year, 11, 31), due: `January 15, ${year + 1}` }
}

export default function NILScreen({ navigation }) {
  const [transactions, setTransactions] = useState([])
  const [yearTransactions, setYearTransactions] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
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

    const now = new Date()
    const quarter = getQuarterDates()

    // Quarter transactions
    const { data: qData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'income')
      .gte('date', quarter.start.toISOString().split('T')[0])
      .lte('date', quarter.end.toISOString().split('T')[0])
      .order('date', { ascending: false })

    // Full year transactions
    const { data: yData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'income')
      .gte('date', new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0])
      .lte('date', new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0])
      .order('date', { ascending: false })

    setTransactions(qData || [])
    setYearTransactions(yData || [])

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

  const quarter = getQuarterDates()

  // NIL specific transactions (tagged with nil_type)
  const nilTransactions = yearTransactions.filter(t => t.nil_type)
  const quarterNilTransactions = transactions.filter(t => t.nil_type)
  const allIncomeTransactions = yearTransactions

  // Financial calculations
  const yearNilTotal = nilTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const quarterNilTotal = quarterNilTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const yearIncomeTotal = allIncomeTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const quarterIncomeTotal = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0)

  // Tax calculations
  const federalTax = quarterIncomeTotal * FEDERAL_TAX_RATE
  const seTax = quarterNilTotal * SE_TAX_RATE // SE tax only on NIL/self-employment
  const totalTaxReserve = federalTax + seTax
  const effectiveRate = quarterIncomeTotal > 0
    ? ((totalTaxReserve / quarterIncomeTotal) * 100).toFixed(1)
    : 0

  // NIL breakdown by type
  const nilByType = NIL_TYPES.map(nilType => {
    const typeTx = nilTransactions.filter(t => t.nil_type === nilType.key)
    const total = typeTx.reduce((sum, t) => sum + parseFloat(t.amount), 0)
    return { ...nilType, total, count: typeTx.length }
  }).filter(t => t.total > 0).sort((a, b) => b.total - a.total)

  // Monthly trend
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const monthTx = yearTransactions.filter(t => new Date(t.date).getMonth() === i)
    const nilTotal = monthTx.filter(t => t.nil_type).reduce((sum, t) => sum + parseFloat(t.amount), 0)
    const otherTotal = monthTx.filter(t => !t.nil_type).reduce((sum, t) => sum + parseFloat(t.amount), 0)
    return { month: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i], nil: nilTotal, other: otherTotal }
  })

  const maxMonthly = Math.max(...monthlyTrend.map(m => m.nil + m.other), 1)

  // Projection
  const currentMonth = new Date().getMonth()
  const monthsWithData = monthlyTrend.filter((m, i) => i <= currentMonth && (m.nil + m.other) > 0).length
  const avgMonthlyNil = monthsWithData > 0 ? yearNilTotal / monthsWithData : 0
  const projectedYearNil = avgMonthlyNil * 12
  const projectedTax = projectedYearNil * (FEDERAL_TAX_RATE + SE_TAX_RATE)

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textOnDark} />
        </TouchableOpacity>
        <View>
          <Text style={styles.heading}>NIL & Income</Text>
          <Text style={styles.subheading}>{new Date().getFullYear()} tax year</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('Main', {
            screen: 'Add',
            params: { nilMode: true }
          })}
        >
          <Text style={styles.addBtnText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, flex: 1 }}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
        }
      >
        {/* Tab switcher */}
        <View style={styles.tabRow}>
          {['overview', 'breakdown', 'history'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setActiveTab(tab)
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <>
            {/* Year summary */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Total NIL income — {new Date().getFullYear()}</Text>
              <Text style={styles.heroAmount}>${formatMoney(yearNilTotal)}</Text>
              <Text style={styles.heroSub}>
                ${formatMoney(yearIncomeTotal - yearNilTotal)} additional income · ${formatMoney(yearIncomeTotal)} total
              </Text>
            </View>

            {/* Quarter tax reserve */}
            <View style={[styles.taxCard, totalTaxReserve === 0 && styles.taxCardGreen]}>
              <View style={styles.taxCardHeader}>
                <View>
                  <Text style={styles.taxCardBadge}>{quarter.label} TAX RESERVE</Text>
                  <Text style={styles.taxCardTitle}>Set aside for taxes</Text>
                </View>
                <View style={styles.taxAmountBox}>
                  <Text style={styles.taxAmount}>${formatMoney(totalTaxReserve)}</Text>
                  <Text style={styles.taxRate}>{effectiveRate}% effective rate</Text>
                </View>
              </View>
              <View style={styles.taxBreakdown}>
                <View style={styles.taxBreakdownRow}>
                  <Text style={styles.taxBreakdownLabel}>Federal income tax (30%)</Text>
                  <Text style={styles.taxBreakdownValue}>${formatMoney(federalTax)}</Text>
                </View>
                <View style={styles.taxBreakdownRow}>
                  <Text style={styles.taxBreakdownLabel}>Self-employment tax (15.3% on NIL)</Text>
                  <Text style={styles.taxBreakdownValue}>${formatMoney(seTax)}</Text>
                </View>
              </View>
              <Text style={styles.taxDue}>Due {quarter.due}</Text>
            </View>

            {/* Projection card */}
            {avgMonthlyNil > 0 && (
              <View style={styles.projectionCard}>
                <View style={styles.projectionHeader}>
                  <Ionicons name="trending-up-outline" size={20} color={colors.emerald} />
                  <Text style={styles.projectionTitle}>Year-end projection</Text>
                </View>
                <Text style={styles.projectionAmount}>${formatMoney(projectedYearNil)}</Text>
                <Text style={styles.projectionSub}>
                  Projected NIL income based on ${formatMoney(avgMonthlyNil)}/month average
                </Text>
                <View style={styles.projectionTaxRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.gold} />
                  <Text style={styles.projectionTaxText}>
                    Set aside ~${formatMoney(projectedTax)} for taxes at this rate
                  </Text>
                </View>
              </View>
            )}

            {/* Quick stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{nilTransactions.length}</Text>
                <Text style={styles.statLabel}>NIL payments</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{nilByType.length}</Text>
                <Text style={styles.statLabel}>Income streams</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  ${nilTransactions.length > 0 ? formatMoney(yearNilTotal / nilTransactions.length) : '0.00'}
                </Text>
                <Text style={styles.statLabel}>Avg payment</Text>
              </View>
            </View>

            {/* Monthly bar chart */}
            <Text style={styles.sectionTitle}>Monthly income — {new Date().getFullYear()}</Text>
            <View style={styles.card}>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.emerald }]} />
                  <Text style={styles.legendText}>NIL</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#60a5fa' }]} />
                  <Text style={styles.legendText}>Other income</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chart}>
                  {monthlyTrend.map((m, i) => {
                    const nilH = Math.max((m.nil / maxMonthly) * 100, m.nil > 0 ? 4 : 0)
                    const otherH = Math.max((m.other / maxMonthly) * 100, m.other > 0 ? 4 : 0)
                    const isCurrentMonth = i === currentMonth
                    return (
                      <View key={i} style={styles.barGroup}>
                        <View style={styles.bars}>
                          <View style={[styles.bar, { height: otherH, backgroundColor: '#60a5fa', opacity: isCurrentMonth ? 1 : 0.4 }]} />
                          <View style={[styles.bar, { height: nilH, backgroundColor: colors.emerald, opacity: isCurrentMonth ? 1 : 0.4 }]} />
                        </View>
                        <Text style={[styles.barLabel, isCurrentMonth && styles.barLabelActive]}>{m.month}</Text>
                      </View>
                    )
                  })}
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.advisorBtn}
              onPress={() => navigation.navigate('Resources', {
                context: `You've earned $${formatMoney(yearNilTotal)} in NIL income this year. A financial advisor can help you minimize your tax burden and plan ahead.`
              })}
            >
              <Ionicons name="people-outline" size={16} color={colors.emerald} />
              <Text style={styles.advisorBtnText}>Talk to a financial advisor about your NIL taxes</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.emerald} />
            </TouchableOpacity>
          </>
        )}

        {/* ── BREAKDOWN TAB ── */}
        {activeTab === 'breakdown' && (
          <>
            <Text style={styles.sectionTitle}>NIL income by type — {new Date().getFullYear()}</Text>

            {nilByType.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏷️</Text>
                <Text style={styles.emptyText}>No NIL income tagged yet</Text>
                <Text style={styles.emptySubText}>
                  When adding income transactions select a NIL type to track them here
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => navigation.navigate('Main', {
                    screen: 'Add',
                    params: { nilMode: true }
                  })}
                >
                  <Text style={styles.emptyBtnText}>Log NIL income</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                {nilByType.map((nilType, i) => {
                  const pct = yearNilTotal > 0 ? (nilType.total / yearNilTotal) * 100 : 0
                  return (
                    <View key={nilType.key} style={i < nilByType.length - 1 ? styles.rowBorder : styles.row}>
                      <View style={[styles.nilTypeIcon, { backgroundColor: `${nilType.color}20` }]}>
                        <Ionicons name={nilType.icon} size={18} color={nilType.color} />
                      </View>
                      <View style={styles.nilTypeInfo}>
                        <View style={styles.nilTypeRow}>
                          <Text style={styles.nilTypeLabel}>{nilType.label}</Text>
                          <Text style={styles.nilTypeAmount}>${formatMoney(nilType.total)}</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: nilType.color }]} />
                        </View>
                        <Text style={styles.nilTypeSub}>
                          {nilType.count} payment{nilType.count !== 1 ? 's' : ''} · {Math.round(pct)}% of NIL
                        </Text>
                      </View>
                    </View>
                  )
                })}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total NIL income</Text>
                  <Text style={styles.totalAmount}>${formatMoney(yearNilTotal)}</Text>
                </View>
              </View>
            )}

            {/* 1099 notice */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
              <View style={styles.infoCardText}>
                <Text style={styles.infoCardTitle}>1099 income reminder</Text>
                <Text style={styles.infoCardBody}>
                  NIL payments over $600 from a single source require a 1099 form. Keep records of all payments and payers for tax filing.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <>
            <Text style={styles.sectionTitle}>All income — {new Date().getFullYear()}</Text>

            {yearTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No income logged yet</Text>
                <Text style={styles.emptySubText}>Add income transactions to see them here</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {yearTransactions.map((t, i) => (
                  <TouchableOpacity
                    key={t.id}
                    style={i < yearTransactions.length - 1 ? styles.txRowBorder : styles.txRow}
                    onPress={() => navigation.navigate('EditTransaction', { transaction: t })}
                  >
                    <View style={styles.txLeft}>
                      {t.nil_type ? (
                        <View style={[
                          styles.txTypeBadge,
                          { backgroundColor: `${NIL_TYPES.find(n => n.key === t.nil_type)?.color || colors.emerald}20` }
                        ]}>
                          <Ionicons
                            name={NIL_TYPES.find(n => n.key === t.nil_type)?.icon || 'cash-outline'}
                            size={14}
                            color={NIL_TYPES.find(n => n.key === t.nil_type)?.color || colors.emerald}
                          />
                        </View>
                      ) : (
                        <View style={[styles.txTypeBadge, { backgroundColor: colors.emeraldLight }]}>
                          <Ionicons name="cash-outline" size={14} color={colors.emerald} />
                        </View>
                      )}
                      <View style={styles.txInfo}>
                        <Text style={styles.txLabel}>{t.label}</Text>
                        <Text style={styles.txMeta}>
                          {t.nil_type
                            ? NIL_TYPES.find(n => n.key === t.nil_type)?.label || t.nil_type
                            : t.category
                          } · {t.date}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.txAmount}>+${formatMoney(t.amount)}</Text>
                  </TouchableOpacity>
                ))}
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
  header: { backgroundColor: colors.dark, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16 },
  heading: { color: colors.textOnDark, fontSize: 20, fontWeight: '700' },
  subheading: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 2 },
  addBtn: { backgroundColor: colors.emerald, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  container: { padding: 20, paddingBottom: 60, backgroundColor: colors.background },
  tabRow: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.dark },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.emerald },
  heroCard: { backgroundColor: colors.dark, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 0.5, borderColor: colors.borderDark },
  heroLabel: { color: colors.textOnDarkMuted, fontSize: 12, marginBottom: 4 },
  heroAmount: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 4 },
  heroSub: { color: colors.textOnDarkMuted, fontSize: 12 },
  taxCard: { backgroundColor: colors.goldLight, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: colors.gold },
  taxCardGreen: { backgroundColor: colors.emeraldLight, borderColor: colors.emerald },
  taxCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  taxCardBadge: { fontSize: 10, fontWeight: '800', color: '#7a5c1e', letterSpacing: 1, marginBottom: 4 },
  taxCardTitle: { fontSize: 15, fontWeight: '700', color: '#4a3000' },
  taxAmountBox: { alignItems: 'flex-end' },
  taxAmount: { fontSize: 24, fontWeight: '700', color: '#4a3000' },
  taxRate: { fontSize: 11, color: '#7a5c1e', marginTop: 2 },
  taxBreakdown: { backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 10, padding: 12, marginBottom: 10 },
  taxBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  taxBreakdownLabel: { fontSize: 12, color: '#7a5c1e' },
  taxBreakdownValue: { fontSize: 12, fontWeight: '600', color: '#4a3000' },
  taxDue: { fontSize: 12, color: '#7a5c1e', textAlign: 'right' },
  projectionCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: colors.emerald },
  projectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  projectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  projectionAmount: { fontSize: 28, fontWeight: '700', color: colors.emerald, marginBottom: 4 },
  projectionSub: { fontSize: 12, color: colors.textSecondary, marginBottom: 10 },
  projectionTaxRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.goldLight, borderRadius: 8, padding: 8 },
  projectionTaxText: { fontSize: 12, color: '#7a5c1e', flex: 1 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  statLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: colors.border },
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.textSecondary },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingBottom: 4 },
  barGroup: { alignItems: 'center', width: 28 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 100 },
  bar: { width: 12, borderRadius: 3 },
  barLabel: { fontSize: 9, color: colors.textMuted, marginTop: 4 },
  barLabelActive: { color: colors.textPrimary, fontWeight: '600' },
  advisorBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.emerald, marginBottom: 8 },
  advisorBtnText: { flex: 1, fontSize: 13, color: colors.emerald, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBorder: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 0.5, borderColor: colors.border, paddingBottom: 14, marginBottom: 14 },
  nilTypeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nilTypeInfo: { flex: 1 },
  nilTypeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  nilTypeLabel: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  nilTypeAmount: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  progressTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, marginBottom: 4 },
  progressFill: { height: 5, borderRadius: 3 },
  nilTypeSub: { fontSize: 11, color: colors.textMuted },
  totalRow: { borderTopWidth: 0.5, borderColor: colors.border, marginTop: 12, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  totalAmount: { fontSize: 13, fontWeight: '700', color: colors.emerald },
  infoCard: { backgroundColor: colors.goldLight, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.gold, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 16 },
  infoCardText: { flex: 1 },
  infoCardTitle: { fontSize: 13, fontWeight: '600', color: '#7a5c1e', marginBottom: 4 },
  infoCardBody: { fontSize: 12, color: '#7a5c1e', lineHeight: 18 },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txRowBorder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderColor: colors.border, paddingBottom: 12, marginBottom: 12 },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  txTypeBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  txMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700', color: colors.income },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  emptySubText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: colors.dark, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: colors.emerald, fontSize: 14, fontWeight: '600' },
})