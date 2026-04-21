import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, TextInput,
  Alert, Animated, RefreshControl
} from 'react-native'
import { supabase } from '../supabase'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'

const formatMoney = (amount) => {
  return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const defaultCategories = [
  'Housing', 'Food', 'Transport', 'Healthcare',
  'Education', 'Entertainment', 'Shopping',
  'Utilities', 'Savings', 'Other'
]

export default function BudgetScreen() {
  const [budgets, setBudgets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingAmount, setEditingAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryLimit, setNewCategoryLimit] = useState('')
  const [customCategories, setCustomCategories] = useState([])
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

    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', session.user.id)

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'expense')
      .gte('date', firstDay)
      .lte('date', lastDay)

    setBudgets(budgetData || [])
    setTransactions(txData || [])

    const savedCustom = (budgetData || [])
      .map(b => b.category)
      .filter(cat => !defaultCategories.includes(cat))
    setCustomCategories(savedCustom)

    setLoading(false)

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

  const getSpent = (category) => {
    return transactions
      .filter(t => t.category === category)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)
  }

  const getBudget = (category) => budgets.find(b => b.category === category)
  const getBudgetLimit = (category) => {
    const budget = getBudget(category)
    return budget ? parseFloat(budget.limit_amount) : null
  }

  const handleSaveBudget = async (category) => {
    if (!editingAmount || isNaN(editingAmount)) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Invalid amount', 'Please enter a valid number.')
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const existing = budgets.find(b => b.category === category)

    if (existing) {
      await supabase.from('budgets').update({ limit_amount: parseFloat(editingAmount) }).eq('id', existing.id)
    } else {
      await supabase.from('budgets').insert({ user_id: session.user.id, category, limit_amount: parseFloat(editingAmount) })
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setEditingId(null)
    setEditingAmount('')
    fetchData()
  }

  const handleDeleteBudget = async (category) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('Delete budget', `Delete the "${category}" budget?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const existing = getBudget(category)
          if (existing) await supabase.from('budgets').delete().eq('id', existing.id)
          setCustomCategories(prev => prev.filter(c => c !== category))
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          fetchData()
        }
      }
    ])
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Missing name', 'Please enter a category name.')
      return
    }
    if (!newCategoryLimit || isNaN(newCategoryLimit)) {
      Alert.alert('Invalid amount', 'Please enter a valid budget limit.')
      return
    }

    const allCats = [...defaultCategories, ...customCategories]
    if (allCats.includes(newCategoryName.trim())) {
      Alert.alert('Already exists', 'A category with this name already exists.')
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { error } = await supabase.from('budgets').insert({
      user_id: session.user.id,
      category: newCategoryName.trim(),
      limit_amount: parseFloat(newCategoryLimit),
    })

    if (error) { Alert.alert('Error', error.message); return }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCustomCategories(prev => [...prev, newCategoryName.trim()])
    setNewCategoryName('')
    setNewCategoryLimit('')
    setShowAddCategory(false)
    fetchData()
  }

  const renderCategory = (cat, isCustom = false) => {
    const limit = getBudgetLimit(cat)
    const spent = getSpent(cat)
    const pct = limit ? Math.min(spent / limit, 1) : 0
    const over = limit && spent > limit
    const isEditing = editingId === cat

    return (
      <View key={cat} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            {isCustom && (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>Custom</Text>
              </View>
            )}
            <Text style={styles.categoryName}>{cat}</Text>
          </View>
          <View style={styles.cardActions}>
            {limit ? (
              <Text style={[styles.amountText, over && styles.overText]}>
                ${formatMoney(spent)} / ${formatMoney(limit)}
              </Text>
            ) : (
              <Text style={styles.noLimitText}>No limit set</Text>
            )}
            {isCustom && (
              <TouchableOpacity onPress={() => handleDeleteBudget(cat)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {limit && (
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              { width: `${pct * 100}%` },
              over ? styles.fillRed : pct > 0.8 ? styles.fillAmber : styles.fillGreen
            ]} />
          </View>
        )}

        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.editInput}
              placeholder="Enter limit"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={editingAmount}
              onChangeText={setEditingAmount}
              autoFocus
            />
            <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveBudget(cat)}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingId(null); setEditingAmount('') }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setEditingId(cat)
              setEditingAmount(limit ? limit.toString() : '')
            }}
          >
            <Text style={styles.editText}>{limit ? 'Edit limit' : 'Set limit'}</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <View>
            <Text style={styles.heading}>Budget</Text>
            <Text style={styles.subheading}>Monthly spending limits</Text>
          </View>
          <TouchableOpacity
            style={styles.addCategoryBtn}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowAddCategory(!showAddCategory)
            }}
          >
            <Text style={styles.addCategoryBtnText}>{showAddCategory ? 'Cancel' : '+ Category'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.container}
        style={{ opacity: fadeAnim, flex: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
        }
      >
        {showAddCategory && (
          <View style={styles.addCategoryCard}>
            <Text style={styles.addCategoryTitle}>New custom category</Text>
            <Text style={styles.label}>Category name</Text>
            <TextInput
              style={styles.editInput}
              placeholder="e.g. Gym, Pet care"
              placeholderTextColor={colors.textMuted}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <Text style={styles.label}>Monthly limit</Text>
            <TextInput
              style={styles.editInput}
              placeholder="e.g. 500"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={newCategoryLimit}
              onChangeText={setNewCategoryLimit}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddCategory}>
              <Text style={styles.saveBtnText}>Add category</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionLabel}>Default categories</Text>
        {defaultCategories.map(cat => renderCategory(cat, false))}

        {customCategories.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Custom categories</Text>
            {customCategories.map(cat => renderCategory(cat, true))}
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  header: { backgroundColor: colors.dark, padding: 24, paddingBottom: 16 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heading: { color: colors.textOnDark, fontSize: 24, fontWeight: '700', marginBottom: 2 },
  subheading: { color: colors.textOnDarkMuted, fontSize: 13 },
  addCategoryBtn: { backgroundColor: colors.emerald, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  addCategoryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  container: { padding: 20, paddingBottom: 60, backgroundColor: colors.background },
  addCategoryCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.emerald },
  addCategoryTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, marginTop: 8, fontWeight: '500' },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardActions: { alignItems: 'flex-end', gap: 4 },
  customBadge: { backgroundColor: colors.emeraldLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  customBadgeText: { fontSize: 10, color: colors.emerald, fontWeight: '600' },
  categoryName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  amountText: { fontSize: 13, color: colors.textSecondary },
  overText: { color: colors.expense },
  noLimitText: { fontSize: 12, color: colors.textMuted },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 6, borderWidth: 0.5, borderColor: colors.expense },
  deleteText: { fontSize: 11, color: colors.expense, fontWeight: '500' },
  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: 10 },
  progressFill: { height: 6, borderRadius: 3 },
  fillGreen: { backgroundColor: colors.emerald },
  fillAmber: { backgroundColor: colors.gold },
  fillRed: { backgroundColor: colors.expense },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  editInput: { flex: 1, backgroundColor: colors.background, borderRadius: 8, padding: 10, fontSize: 14, color: colors.textPrimary, borderWidth: 0.5, borderColor: colors.border },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 10 },
  cancelBtnText: { color: colors.textSecondary, fontSize: 13 },
  editText: { fontSize: 13, color: colors.emerald, marginTop: 4 },
})