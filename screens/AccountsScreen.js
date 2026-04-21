import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Animated, RefreshControl
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const accountTypeIcons = {
  checking: 'card-outline',
  savings: 'save-outline',
  'credit card': 'card-outline',
  cash: 'cash-outline',
  investment: 'trending-up-outline',
  'credit line': 'card-outline',
}

const accountTypeColors = {
  checking: colors.emerald,
  savings: '#60a5fa',
  'credit card': colors.expense,
  cash: colors.income,
  investment: colors.gold,
  'credit line': colors.expense,
}

export default function AccountsScreen({ navigation }) {
  const [accounts, setAccounts] = useState([])
  const [profile, setProfile] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [totalBalance, setTotalBalance] = useState(0)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0)
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
      .select('full_name')
      .eq('id', session.user.id)
      .single()
    setProfile(profileData)

    const { data: accountData } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })

    if (accountData) {
      const accountsWithBalances = await Promise.all(
        accountData.map(async (account) => {
          const { data: txData } = await supabase
            .from('transactions')
            .select('amount, type')
            .eq('account_id', account.id)
            .eq('status', 'cleared')

          const balance = (txData || []).reduce((sum, t) => {
            if (t.type === 'income') return sum + parseFloat(t.amount)
            if (t.type === 'expense') return sum - parseFloat(t.amount)
            return sum
          }, parseFloat(account.balance || 0))

          return { ...account, currentBalance: balance }
        })
      )

      setAccounts(accountsWithBalances)

      const total = accountsWithBalances
        .filter(a => a.include_in_total)
        .reduce((sum, a) => sum + a.currentBalance, 0)
      setTotalBalance(total)
    }

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString().split('T')[0]

    const { data: txData } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', session.user.id)
      .gte('date', firstDay)
      .lte('date', lastDay)

    if (txData) {
      const income = txData
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const expenses = txData
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0)
      setMonthlyIncome(income)
      setMonthlyExpenses(expenses)
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

  const groupedAccounts = accounts.reduce((groups, account) => {
    const type = account.type
    if (!groups[type]) groups[type] = []
    groups[type].push(account)
    return groups
  }, {})

  const currentMonth = new Date().toLocaleString('default', { month: 'long' })
  const netBalance = monthlyIncome - monthlyExpenses

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
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
            <View>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.userName}>{profile?.full_name || ''}</Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                navigation.navigate('Profile')
              }}
            >
              <View style={styles.profileAvatar}>
                <Text style={styles.profileInitials}>
                  {profile?.full_name
                    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    : '?'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Net worth card */}
          <View style={styles.netWorthCard}>
            <Text style={styles.netWorthLabel}>Total net worth</Text>
            <Text style={styles.netWorthAmount}>${formatMoney(totalBalance)}</Text>
            <Text style={styles.netWorthSub}>
              {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <Animated.View style={[styles.body, { opacity: fadeAnim }]}>

          {/* Financial Summary card */}
          <TouchableOpacity
            style={styles.summaryCard}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.navigate('FinancialSummary')
            }}
          >
            <View style={styles.summaryCardHeader}>
              <View>
                <Text style={styles.summaryCardTitle}>Financial summary</Text>
                <Text style={styles.summaryCardSub}>{currentMonth} overview</Text>
              </View>
              <View style={styles.summaryViewBtn}>
                <Text style={styles.summaryViewBtnText}>View</Text>
                <Ionicons name="chevron-forward" size={12} color="#fff" />
              </View>
            </View>
            <View style={styles.summaryCardStats}>
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatLabel}>Income</Text>
                <Text style={styles.summaryStatIncome}>+${formatMoney(monthlyIncome)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatLabel}>Expenses</Text>
                <Text style={styles.summaryStatExpense}>-${formatMoney(monthlyExpenses)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatLabel}>Net</Text>
                <Text style={[
                  styles.summaryStatNet,
                  netBalance < 0 && styles.summaryStatNetNeg
                ]}>
                  {netBalance >= 0 ? '+' : '-'}${formatMoney(Math.abs(netBalance))}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Accounts list */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Accounts</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                navigation.navigate('AddAccount')
              }}
            >
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {accounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏦</Text>
              <Text style={styles.emptyText}>No accounts yet</Text>
              <Text style={styles.emptySubText}>Tap + Add to create your first account</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('AddAccount')}
              >
                <Text style={styles.emptyBtnText}>Add account</Text>
              </TouchableOpacity>
            </View>
          ) : (
            Object.entries(groupedAccounts).map(([type, accs]) => (
              <View key={type}>
                <Text style={styles.groupLabel}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
                <View style={styles.card}>
                  {accs.map((account, i) => (
                    <TouchableOpacity
                      key={account.id}
                      style={i < accs.length - 1 ? styles.accountRowBorder : styles.accountRow}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        navigation.navigate('AccountDetail', { account })
                      }}
                    >
                      <View style={[
                        styles.accountIcon,
                        { backgroundColor: `${accountTypeColors[account.type] || colors.emerald}20` }
                      ]}>
                        <Ionicons
                          name={accountTypeIcons[account.type] || 'card-outline'}
                          size={20}
                          color={accountTypeColors[account.type] || colors.emerald}
                        />
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={styles.accountName}>{account.name}</Text>
                        <Text style={styles.accountType}>{account.type}</Text>
                      </View>
                      <View style={styles.accountRight}>
                        <Text style={[
                          styles.accountBalance,
                          account.currentBalance < 0 && styles.negativeBalance
                        ]}>
                          {account.currentBalance < 0 ? '-' : ''}
                          ${formatMoney(Math.abs(account.currentBalance))}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}

          {/* Quick links */}
          {accounts.length > 0 && (
            <View style={styles.quickLinks}>
              <TouchableOpacity
                style={styles.quickLink}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  navigation.navigate('Transactions')
                }}
              >
                <Ionicons name="list-outline" size={18} color={colors.emerald} />
                <Text style={styles.quickLinkText}>All transactions</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.quickLinkDivider} />
              <TouchableOpacity
                style={styles.quickLink}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  navigation.navigate('RecurringTransactions')
                }}
              >
                <Ionicons name="repeat-outline" size={18} color={colors.emerald} />
                <Text style={styles.quickLinkText}>Recurring transactions</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  header: { backgroundColor: colors.dark, padding: 24, paddingTop: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  welcomeText: { color: colors.textOnDarkMuted, fontSize: 13 },
  userName: { color: colors.textOnDark, fontSize: 22, fontWeight: '600' },
  profileAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.gold },
  profileInitials: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  netWorthCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: colors.borderDark },
  netWorthLabel: { color: colors.textOnDarkMuted, fontSize: 12, marginBottom: 4 },
  netWorthAmount: { color: colors.textOnDark, fontSize: 36, fontWeight: '700', marginBottom: 4 },
  netWorthSub: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  body: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, flex: 1, minHeight: 600 },
  summaryCard: { backgroundColor: colors.dark, borderRadius: 16, padding: 16, marginBottom: 20 },
  summaryCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  summaryCardTitle: { color: colors.textOnDark, fontSize: 15, fontWeight: '700' },
  summaryCardSub: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 2 },
  summaryViewBtn: { backgroundColor: colors.emerald, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryViewBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  summaryCardStats: { flexDirection: 'row' },
  summaryStatItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.1)' },
  summaryStatLabel: { color: colors.textOnDarkMuted, fontSize: 11, marginBottom: 4 },
  summaryStatIncome: { color: colors.income, fontSize: 14, fontWeight: '700' },
  summaryStatExpense: { color: colors.expense, fontSize: 14, fontWeight: '700' },
  summaryStatNet: { color: colors.income, fontSize: 14, fontWeight: '700' },
  summaryStatNetNeg: { color: colors.expense },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  addBtn: { backgroundColor: colors.dark, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  groupLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 0.5, borderColor: colors.border },
  accountRow: { flexDirection: 'row', alignItems: 'center' },
  accountRowBorder: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderColor: colors.border, paddingBottom: 14, marginBottom: 14 },
  accountIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  accountType: { fontSize: 12, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  accountRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accountBalance: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  negativeBalance: { color: colors.expense },
  quickLinks: { backgroundColor: colors.card, borderRadius: 16, marginTop: 8, borderWidth: 0.5, borderColor: colors.border, overflow: 'hidden' },
  quickLink: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  quickLinkText: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  quickLinkDivider: { height: 0.5, backgroundColor: colors.border, marginHorizontal: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  emptySubText: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  emptyBtn: { backgroundColor: colors.dark, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: colors.emerald, fontSize: 15, fontWeight: '600' },
})