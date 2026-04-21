import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Animated, RefreshControl
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const TAX_RATE = 0.30

const quarterlyDates = [
  { quarter: 'Q1', due: 'April 15, 2026', months: 'Jan — Mar' },
  { quarter: 'Q2', due: 'June 16, 2026', months: 'Apr — Jun' },
  { quarter: 'Q3', due: 'September 15, 2026', months: 'Jul — Sep' },
  { quarter: 'Q4', due: 'January 15, 2027', months: 'Oct — Dec' },
]

const deductibleCategories = ['Training', 'Travel', 'Equipment', 'Medical', 'Agent fees', 'Healthcare', 'Education']

export default function TaxScreen() {
  const [transactions, setTransactions] = useState([])
  const [paidQuarters, setPaidQuarters] = useState([])
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
    if (!session?.user) return

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('date', firstDay)
      .lte('date', lastDay)

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

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const totalDeductible = transactions.filter(t => t.type === 'expense' && deductibleCategories.includes(t.category)).reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const taxableIncome = Math.max(totalIncome - totalDeductible, 0)
  const estimatedTax = taxableIncome * TAX_RATE
  const deductibleTransactions = transactions.filter(t => t.type === 'expense' && deductibleCategories.includes(t.category))

  const toggleQuarter = async (quarter) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPaidQuarters(prev =>
      prev.includes(quarter) ? prev.filter(q => q !== quarter) : [...prev, quarter]
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.heading}>Tax</Text>
        <Text style={styles.subheading}>Based on this month's income and deductibles</Text>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.container}
        style={{ opacity: fadeAnim, flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
        }
      >
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total income</Text>
            <Text style={styles.summaryValue}>${formatMoney(totalIncome)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Deductibles</Text>
            <Text style={[styles.summaryValue, { color: colors.income }]}>-${formatMoney(totalDeductible)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Taxable income</Text>
            <Text style={styles.summaryValue}>${formatMoney(taxableIncome)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardHighlight]}>
            <Text style={styles.summaryLabelLight}>Est. tax (30%)</Text>
            <Text style={styles.summaryValueLight}>${formatMoney(estimatedTax)}</Text>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This is an estimate at a 30% rate. Consult a tax professional for accurate filing.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Quarterly estimated payments</Text>
        <View style={styles.card}>
          {quarterlyDates.map((q, i) => {
            const isPaid = paidQuarters.includes(q.quarter)
            return (
              <View key={q.quarter} style={i < quarterlyDates.length - 1 ? styles.qRowBorder : styles.qRow}>
                <View style={styles.qLeft}>
                  <View style={[styles.qBadge, isPaid && styles.qBadgePaid]}>
                    <Text style={[styles.qBadgeText, isPaid && styles.qBadgeTextPaid]}>{q.quarter}</Text>
                  </View>
                  <View>
                    <Text style={styles.qMonths}>{q.months}</Text>
                    <Text style={styles.qDue}>Due {q.due}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.paidBtn, isPaid && styles.paidBtnActive]}
                  onPress={() => toggleQuarter(q.quarter)}
                >
                  <Text style={[styles.paidBtnText, isPaid && styles.paidBtnTextActive]}>
                    {isPaid ? 'Paid ✓' : 'Mark paid'}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>

        <Text style={styles.sectionTitle}>Deductible expenses this month</Text>
        <View style={styles.card}>
          {deductibleTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyText}>No deductible expenses</Text>
              <Text style={styles.emptySubText}>
                Expenses tagged as Training, Travel, Equipment, Medical, Healthcare or Education will appear here
              </Text>
            </View>
          ) : (
            deductibleTransactions.map((t, i) => (
              <View key={t.id} style={i < deductibleTransactions.length - 1 ? styles.txRowBorder : styles.txRow}>
                <View style={styles.txInfo}>
                  <Text style={styles.txLabel}>{t.label}</Text>
                  <Text style={styles.txCategory}>{t.category}</Text>
                </View>
                <Text style={styles.txAmount}>-${formatMoney(t.amount)}</Text>
              </View>
            ))
          )}
          {deductibleTransactions.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total deductible</Text>
              <Text style={styles.totalAmount}>${formatMoney(totalDeductible)}</Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  header: { backgroundColor: colors.dark, padding: 24, paddingBottom: 16 },
  heading: { color: colors.textOnDark, fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subheading: { color: colors.textOnDarkMuted, fontSize: 13 },
  container: { padding: 20, paddingBottom: 60, backgroundColor: colors.background },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  summaryCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, width: '47%', borderWidth: 0.5, borderColor: colors.border },
  summaryCardHighlight: { backgroundColor: colors.dark },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  summaryLabelLight: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  summaryValueLight: { fontSize: 18, fontWeight: '700', color: '#fff' },
  disclaimer: { backgroundColor: colors.goldLight, borderRadius: 10, padding: 12, marginBottom: 24, borderWidth: 0.5, borderColor: colors.gold },
  disclaimerText: { fontSize: 12, color: '#7a5c1e' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: colors.border },
  qRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qRowBorder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderColor: colors.border, paddingBottom: 12, marginBottom: 12 },
  qLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qBadge: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: colors.border },
  qBadgePaid: { backgroundColor: colors.emeraldLight, borderColor: colors.emerald },
  qBadgeText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  qBadgeTextPaid: { color: colors.emerald },
  qMonths: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  qDue: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  paidBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5, borderColor: colors.border, backgroundColor: colors.background },
  paidBtnActive: { backgroundColor: colors.emeraldLight, borderColor: colors.emerald },
  paidBtnText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  paidBtnTextActive: { color: colors.emerald },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txRowBorder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderColor: colors.border, paddingBottom: 12, marginBottom: 12 },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  txCategory: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: '600', color: colors.expense },
  totalRow: { borderTopWidth: 0.5, borderColor: colors.border, marginTop: 12, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  totalAmount: { fontSize: 13, fontWeight: '700', color: colors.emerald },
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  emptySubText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
})