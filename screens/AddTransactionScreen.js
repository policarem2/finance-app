import React, { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  Animated, Platform, KeyboardAvoidingView,
  Alert, Modal, ActivityIndicator, Image
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../supabase'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme'
import { checkBudgetAlert, checkLargeDepositAlert } from '../alertHelpers'
import { scanReceipt } from '../receiptScanner'
import { Ionicons } from '@expo/vector-icons'

const defaultCategories = [
  'Salary', 'Bonus', 'Endorsement', 'Prize money',
  'Housing', 'Food', 'Transport', 'Healthcare',
  'Education', 'Entertainment', 'Shopping',
  'Utilities', 'Travel', 'Equipment', 'Medical',
  'Agent fees', 'Tax payment'
]

const NIL_TYPES = [
  { key: 'sponsorship', label: 'Sponsorship' },
  { key: 'endorsement', label: 'Endorsement' },
  { key: 'appearance', label: 'Appearance fee' },
  { key: 'prize', label: 'Prize money' },
  { key: 'social_media', label: 'Social media' },
  { key: 'licensing', label: 'Licensing' },
  { key: 'other', label: 'Other NIL' },
]

export default function AddTransactionScreen({ route }) {
  const navigation = useNavigation()
  const preselectedAccountId = route?.params?.accountId || null
  const nilMode = route?.params?.nilMode || false

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState(nilMode ? 'income' : 'expense')
  const [category, setCategory] = useState(null)
  const [payee, setPayee] = useState('')
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [allCategories, setAllCategories] = useState(defaultCategories)
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState(preselectedAccountId)
  const [transferAccountId, setTransferAccountId] = useState(null)
  const [nilType, setNilType] = useState(null)
  const [alertData, setAlertData] = useState(null)
  const [showAlert, setShowAlert] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scannedImage, setScannedImage] = useState(null)
  const [scanConfidence, setScanConfidence] = useState(null)

  const scaleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const formFadeAnim = useRef(new Animated.Value(1)).current

  useFocusEffect(
    useCallback(() => {
      fetchData()
      setSuccess(false)
      scaleAnim.setValue(0)
      fadeAnim.setValue(0)
      formFadeAnim.setValue(1)
      if (route?.params?.accountId) {
        setSelectedAccountId(route.params.accountId)
      }
      if (route?.params?.nilMode) {
        setType('income')
      }
    }, [route?.params?.accountId, route?.params?.nilMode])
  )

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: budgetData } = await supabase
      .from('budgets')
      .select('category')
      .eq('user_id', session.user.id)

    if (budgetData) {
      const customCats = budgetData
        .map(b => b.category)
        .filter(cat => !defaultCategories.includes(cat))
      setAllCategories([...defaultCategories, ...customCats])
    }

    const { data: accountData } = await supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', session.user.id)

    setAccounts(accountData || [])

    if (!preselectedAccountId && accountData?.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountData[0].id)
    }
  }

  const handleScanReceipt = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Scan receipt',
      'Choose how to add your receipt',
      [
        { text: 'Take photo', onPress: () => openCamera() },
        { text: 'Choose from library', onPress: () => openLibrary() },
        { text: 'Cancel', style: 'cancel' }
      ]
    )
  }

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to scan receipts.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,          // max quality
      base64: true,
      exif: false,
      allowsEditing: true, // lets user crop/straighten before sending
      aspect: [3, 4],      // portrait aspect for receipts
    })
    if (!result.canceled && result.assets[0]) processReceipt(result.assets[0])
  }

  const openLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    })
    if (!result.canceled && result.assets[0]) processReceipt(result.assets[0])
  }

  const processReceipt = async (asset) => {
    setScanning(true)
    setScannedImage(asset.uri)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const result = await scanReceipt(asset.base64)
    setScanning(false)

    if (result.success) {
      const { data } = result
      if (data.amount) setAmount(data.amount.toString())
      if (data.payee) setPayee(data.payee)
      if (data.description) setLabel(data.description)
      if (data.category) setCategory(data.category)
      if (data.date) {
        const parsedDate = new Date(data.date)
        if (!isNaN(parsedDate)) setDate(parsedDate)
      }
      setType('expense')
      setScanConfidence(data.confidence)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      setScannedImage(null)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Could not read receipt', 'Try again with a clearer photo or enter details manually.')
    }
  }

  const showSuccessAnimation = () => {
    Animated.timing(formFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSuccess(true)
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setSuccess(false)
            scaleAnim.setValue(0)
            formFadeAnim.setValue(1)
            resetForm()
          })
        }, 1800)
      })
    })
  }

  const resetForm = () => {
    setLabel('')
    setAmount('')
    setPayee('')
    setType('expense')
    setCategory(null)
    setDate(new Date())
    setStatus('pending')
    setTransferAccountId(null)
    setNilType(null)
    setScannedImage(null)
    setScanConfidence(null)
    if (!preselectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id)
    }
  }

  const handleAmountChange = (text) => {
    const cleaned = text.replace(/[^0-9.]/g, '')
    setAmount(cleaned)
  }

  const handleSave = async () => {
    if (!label || !amount) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing fields', 'Please fill in description and amount.')
      return
    }

    if (type !== 'transfer' && !category) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing category', 'Please select a category.')
      return
    }

    if (type === 'transfer' && !transferAccountId) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing account', 'Please select a destination account.')
      return
    }

    if (!selectedAccountId) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Missing account', 'Please select an account for this transaction.')
      return
    }

    setLoading(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const { data: { user } } = await supabase.auth.getUser()

    if (type === 'transfer') {
      await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: selectedAccountId,
        label,
        amount: parseFloat(amount),
        type: 'expense',
        category: 'Transfer',
        payee: accounts.find(a => a.id === transferAccountId)?.name || 'Transfer',
        status,
        date: date.toISOString().split('T')[0],
        transfer_account_id: transferAccountId,
      })

      await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: transferAccountId,
        label,
        amount: parseFloat(amount),
        type: 'income',
        category: 'Transfer',
        payee: accounts.find(a => a.id === selectedAccountId)?.name || 'Transfer',
        status,
        date: date.toISOString().split('T')[0],
        transfer_account_id: selectedAccountId,
      })

      setLoading(false)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showSuccessAnimation()
      return
    }

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      account_id: selectedAccountId,
      label,
      amount: parseFloat(amount),
      type,
      category,
      payee,
      status,
      nil_type: nilType || null,
      date: date.toISOString().split('T')[0],
    })

    setLoading(false)

    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error.message)
      return
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    let alert = null
    if (type === 'expense') {
      alert = await checkBudgetAlert(user.id, category, amount)
    }
    if (!alert && type === 'income') {
      alert = checkLargeDepositAlert(amount)
    }

    if (alert) {
      setAlertData(alert)
      setShowAlert(true)
      resetForm()
    } else {
      showSuccessAnimation()
    }
  }

  const formatDate = (d) => {
    return d.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const selectedAccountName = accounts.find(a => a.id === selectedAccountId)?.name

  const incomeCategories = ['Salary', 'Bonus', 'Endorsement', 'Prize money']
  const expenseCategories = allCategories.filter(c => !incomeCategories.includes(c))
  const customCategories = allCategories.filter(c => !defaultCategories.includes(c))
  const categoriesToShow = type === 'income'
    ? incomeCategories
    : [...expenseCategories, ...customCategories.filter(c => !expenseCategories.includes(c))]

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.successContainer, { opacity: fadeAnim }]}>
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.checkMark}>✓</Text>
          </Animated.View>
          <Text style={styles.successTitle}>
            {type === 'transfer' ? 'Transfer complete!' : 'Transaction saved!'}
          </Text>
          <Text style={styles.successSub}>
            {type === 'transfer'
              ? 'Both accounts have been updated'
              : `Saved to ${selectedAccountName || 'your account'}`
            }
          </Text>
        </Animated.View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* Smart Alert Modal */}
      <Modal
        visible={showAlert}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAlert(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            {alertData?.type === 'budget_exceeded' && (
              <>
                <View style={styles.alertIconCircle}>
                  <Ionicons name="warning-outline" size={32} color={colors.expense} />
                </View>
                <Text style={styles.alertTitle}>Budget exceeded</Text>
                <Text style={styles.alertMessage}>{alertData.message}</Text>
                <View style={styles.alertStats}>
                  <View style={styles.alertStat}>
                    <Text style={styles.alertStatLabel}>Spent</Text>
                    <Text style={[styles.alertStatValue, { color: colors.expense }]}>
                      ${parseFloat(alertData.newTotal).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.alertStatDivider} />
                  <View style={styles.alertStat}>
                    <Text style={styles.alertStatLabel}>Budget</Text>
                    <Text style={styles.alertStatValue}>
                      ${parseFloat(alertData.limit).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.alertStatDivider} />
                  <View style={styles.alertStat}>
                    <Text style={styles.alertStatLabel}>Over by</Text>
                    <Text style={[styles.alertStatValue, { color: colors.expense }]}>
                      ${parseFloat(alertData.overage).toFixed(2)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.alertSuggestion}>
                  Would you like to speak with a financial advisor about managing your {alertData.category} expenses?
                </Text>
                <TouchableOpacity
                  style={styles.alertPrimaryBtn}
                  onPress={() => {
                    setShowAlert(false)
                    navigation.navigate('Resources', {
                      context: `You recently exceeded your ${alertData.category} budget. A financial advisor can help you get back on track.`
                    })
                  }}
                >
                  <Ionicons name="people-outline" size={16} color="#fff" />
                  <Text style={styles.alertPrimaryBtnText}>Find a financial advisor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.alertSecondaryBtn}
                  onPress={() => setShowAlert(false)}
                >
                  <Text style={styles.alertSecondaryBtnText}>I'll manage it myself</Text>
                </TouchableOpacity>
              </>
            )}

            {alertData?.type === 'budget_warning' && (
              <>
                <View style={[styles.alertIconCircle, { backgroundColor: colors.goldLight }]}>
                  <Ionicons name="alert-circle-outline" size={32} color={colors.gold} />
                </View>
                <Text style={styles.alertTitle}>Almost at your limit</Text>
                <Text style={styles.alertMessage}>{alertData.message}</Text>
                <View style={styles.alertStats}>
                  <View style={styles.alertStat}>
                    <Text style={styles.alertStatLabel}>Spent</Text>
                    <Text style={[styles.alertStatValue, { color: colors.gold }]}>
                      ${parseFloat(alertData.newTotal).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.alertStatDivider} />
                  <View style={styles.alertStat}>
                    <Text style={styles.alertStatLabel}>Remaining</Text>
                    <Text style={[styles.alertStatValue, { color: colors.emerald }]}>
                      ${parseFloat(alertData.remaining).toFixed(2)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.alertPrimaryBtn, { backgroundColor: colors.gold }]}
                  onPress={() => {
                    setShowAlert(false)
                    navigation.navigate('Resources', {
                      context: `You're approaching your ${alertData.category} budget limit. A financial advisor can help you plan ahead.`
                    })
                  }}
                >
                  <Ionicons name="people-outline" size={16} color="#fff" />
                  <Text style={styles.alertPrimaryBtnText}>Get budgeting advice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.alertSecondaryBtn}
                  onPress={() => setShowAlert(false)}
                >
                  <Text style={styles.alertSecondaryBtnText}>Got it, thanks</Text>
                </TouchableOpacity>
              </>
            )}

            {alertData?.type === 'large_deposit' && (
              <>
                <View style={[styles.alertIconCircle, { backgroundColor: colors.emeraldLight }]}>
                  <Ionicons name="trending-up-outline" size={32} color={colors.emerald} />
                </View>
                <Text style={styles.alertTitle}>Nice deposit!</Text>
                <Text style={styles.alertMessage}>{alertData.message}</Text>
                <Text style={styles.alertSuggestion}>
                  A financial advisor could help you invest, save or plan with this money strategically.
                </Text>
                <TouchableOpacity
                  style={styles.alertPrimaryBtn}
                  onPress={() => {
                    setShowAlert(false)
                    navigation.navigate('Resources', {
                      context: `You recently logged a large deposit of $${parseFloat(alertData.amount).toLocaleString()}. A financial advisor can help you make the most of it.`
                    })
                  }}
                >
                  <Ionicons name="people-outline" size={16} color="#fff" />
                  <Text style={styles.alertPrimaryBtnText}>Talk to a financial advisor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.alertSecondaryBtn}
                  onPress={() => setShowAlert(false)}
                >
                  <Text style={styles.alertSecondaryBtnText}>Maybe later</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </Modal>

      {/* Scanning overlay */}
      <Modal visible={scanning} transparent animationType="fade">
        <View style={styles.scanningOverlay}>
          <View style={styles.scanningCard}>
            <ActivityIndicator size="large" color={colors.emerald} />
            <Text style={styles.scanningTitle}>Reading your receipt...</Text>
            <Text style={styles.scanningText}>Claude AI is extracting the transaction details</Text>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>Add transaction</Text>
          <TouchableOpacity style={styles.scanBtn} onPress={handleScanReceipt}>
            <Ionicons name="camera-outline" size={20} color={colors.emerald} />
          </TouchableOpacity>
        </View>

        <Animated.ScrollView
          contentContainerStyle={styles.container}
          style={{ opacity: formFadeAnim, flex: 1 }}
          keyboardShouldPersistTaps="handled"
        >

          {/* Scanned image preview */}
          {scannedImage && (
            <View style={styles.scannedPreview}>
              <Image
                source={{ uri: scannedImage }}
                style={styles.scannedImage}
                resizeMode="cover"
              />
              <View style={styles.scannedInfo}>
                <View style={styles.scannedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.emerald} />
                  <Text style={styles.scannedBadgeText}>Receipt scanned</Text>
                </View>
                {scanConfidence && (
                  <Text style={styles.scannedConfidence}>
                    Confidence: {scanConfidence}
                  </Text>
                )}
                <Text style={styles.scannedHint}>
                  Review and adjust the fields below before saving
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { setScannedImage(null); setScanConfidence(null) }}
                style={styles.scannedClear}
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Account selector */}
          <Text style={styles.label}>Account</Text>
          {accounts.length === 0 ? (
            <View style={styles.noAccountsBox}>
              <Text style={styles.noAccountsText}>
                Create an account first to add transactions.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.accountScroll}
            >
              {accounts.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.accountChip,
                    selectedAccountId === a.id && styles.accountChipActive
                  ]}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedAccountId(a.id)
                  }}
                >
                  <Text style={[
                    styles.accountChipText,
                    selectedAccountId === a.id && styles.accountChipTextActive
                  ]}>
                    {a.name}
                  </Text>
                  <Text style={[
                    styles.accountChipType,
                    selectedAccountId === a.id && styles.accountChipTypeActive
                  ]}>
                    {a.type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Type toggle */}
          <Text style={styles.label}>Type</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'expense' && styles.toggleActiveExpense]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setType('expense')
              }}
            >
              <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'income' && styles.toggleActiveIncome]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setType('income')
              }}
            >
              <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>
                Income
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'transfer' && styles.toggleActiveTransfer]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setType('transfer')
              }}
            >
              <Text style={[styles.toggleText, type === 'transfer' && styles.toggleTextActive]}>
                Transfer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Grocery run"
            placeholderTextColor={colors.textMuted}
            value={label}
            onChangeText={setLabel}
          />

          {/* Payee */}
          {type !== 'transfer' && (
            <>
              <Text style={styles.label}>
                Payee <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Whole Foods"
                placeholderTextColor={colors.textMuted}
                value={payee}
                onChangeText={setPayee}
              />
            </>
          )}

          {/* Date */}
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.datePicker}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowDatePicker(true)
            }}
          >
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            <Text style={styles.dateIcon}>📅</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios')
                if (selectedDate) setDate(selectedDate)
                if (Platform.OS !== 'ios') setShowDatePicker(false)
              }}
            />
          )}

          {/* Status */}
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[styles.statusChip, status === 'pending' && styles.statusChipPending]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setStatus('pending')
              }}
            >
              <Text style={[styles.statusText, status === 'pending' && styles.statusTextPending]}>
                Pending
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusChip, status === 'cleared' && styles.statusChipCleared]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setStatus('cleared')
              }}
            >
              <Text style={[styles.statusText, status === 'cleared' && styles.statusTextCleared]}>
                Cleared
              </Text>
            </TouchableOpacity>
          </View>

          {/* Transfer destination */}
          {type === 'transfer' && (
            <>
              <Text style={styles.label}>To account</Text>
              {accounts.filter(a => a.id !== selectedAccountId).length === 0 ? (
                <View style={styles.noAccountsBox}>
                  <Text style={styles.noAccountsText}>
                    You need at least 2 accounts to make a transfer.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.accountScroll}
                >
                  {accounts
                    .filter(a => a.id !== selectedAccountId)
                    .map(a => (
                      <TouchableOpacity
                        key={a.id}
                        style={[
                          styles.accountChip,
                          transferAccountId === a.id && styles.accountChipActive
                        ]}
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setTransferAccountId(a.id)
                        }}
                      >
                        <Text style={[
                          styles.accountChipText,
                          transferAccountId === a.id && styles.accountChipTextActive
                        ]}>
                          {a.name}
                        </Text>
                        <Text style={[
                          styles.accountChipType,
                          transferAccountId === a.id && styles.accountChipTypeActive
                        ]}>
                          {a.type}
                        </Text>
                      </TouchableOpacity>
                    ))
                  }
                </ScrollView>
              )}
            </>
          )}

          {/* Category */}
          {type !== 'transfer' && (
            <>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {categoriesToShow.map((cat) => {
                  const isCustom = !defaultCategories.includes(cat)
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        category === cat && styles.categoryChipActive,
                        isCustom && styles.categoryChipCustom,
                        category === cat && isCustom && styles.categoryChipCustomActive,
                      ]}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setCategory(cat)
                      }}
                    >
                      <Text style={[
                        styles.categoryText,
                        category === cat && styles.categoryTextActive
                      ]}>
                        {cat}
                      </Text>
                      {isCustom && (
                        <Text style={[
                          styles.customTag,
                          category === cat && styles.customTagActive
                        ]}>
                          custom
                        </Text>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </>
          )}

          {/* NIL type selector — income only */}
          {type === 'income' && (
            <>
              <Text style={styles.label}>
                NIL type <Text style={styles.optional}>(optional)</Text>
              </Text>
              <Text style={styles.nilHint}>
                Tag this as NIL income to track it in your NIL dashboard
              </Text>
              <View style={styles.categoryGrid}>
                {NIL_TYPES.map(n => (
                  <TouchableOpacity
                    key={n.key}
                    style={[
                      styles.categoryChip,
                      nilType === n.key && styles.nilChipActive,
                    ]}
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setNilType(nilType === n.key ? null : n.key)
                    }}
                  >
                    <Text style={[
                      styles.categoryText,
                      nilType === n.key && styles.categoryTextActive
                    ]}>
                      {n.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveBtnText}>
              {loading
                ? 'Saving...'
                : type === 'transfer'
                  ? 'Complete transfer'
                  : 'Save transaction'
              }
            </Text>
          </TouchableOpacity>

          {/* Scan receipt button */}
          {!scannedImage && (
            <TouchableOpacity
              style={styles.scanReceiptBtn}
              onPress={handleScanReceipt}
            >
              <Ionicons name="camera-outline" size={18} color={colors.emerald} />
              <Text style={styles.scanReceiptBtnText}>Scan a receipt instead</Text>
            </TouchableOpacity>
          )}

        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  flex: { flex: 1 },
  header: { backgroundColor: colors.dark, padding: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: colors.textOnDark, fontSize: 24, fontWeight: '700' },
  scanBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.emeraldLight, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: colors.emerald },
  container: { padding: 20, paddingBottom: 60, backgroundColor: colors.background },
  scannedPreview: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', marginBottom: 20, borderWidth: 0.5, borderColor: colors.emerald },
  scannedImage: { width: '100%', height: 120 },
  scannedInfo: { padding: 12 },
  scannedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  scannedBadgeText: { color: colors.emerald, fontSize: 13, fontWeight: '600' },
  scannedConfidence: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, textTransform: 'capitalize' },
  scannedHint: { fontSize: 12, color: colors.textMuted },
  scannedClear: { position: 'absolute', top: 8, right: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 8 },
  optional: { fontWeight: '400', color: colors.textMuted },
  nilHint: { fontSize: 12, color: colors.textMuted, marginBottom: 8, marginTop: -4 },
  accountScroll: { marginBottom: 8 },
  accountChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, marginRight: 10, alignItems: 'center', minWidth: 110 },
  accountChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  accountChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  accountChipTextActive: { color: colors.emerald },
  accountChipType: { fontSize: 10, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  accountChipTypeActive: { color: 'rgba(255,255,255,0.4)' },
  noAccountsBox: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.border, marginBottom: 8 },
  noAccountsText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 4, marginBottom: 8 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  toggleActiveExpense: { backgroundColor: colors.expense },
  toggleActiveIncome: { backgroundColor: colors.income },
  toggleActiveTransfer: { backgroundColor: '#60a5fa' },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  input: { backgroundColor: colors.card, borderRadius: 12, padding: 16, fontSize: 15, color: colors.textPrimary, borderWidth: 0.5, borderColor: colors.border, marginBottom: 4 },
  datePicker: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dateText: { fontSize: 15, color: colors.textPrimary },
  dateIcon: { fontSize: 16 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statusChip: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center' },
  statusChipPending: { backgroundColor: colors.goldLight, borderColor: colors.gold },
  statusChipCleared: { backgroundColor: colors.emeraldLight, borderColor: colors.emerald },
  statusText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  statusTextPending: { color: '#7a5c1e' },
  statusTextCleared: { color: colors.emerald },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  categoryChipCustom: { borderColor: colors.emerald },
  categoryChipCustomActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  nilChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  categoryText: { fontSize: 13, color: colors.textSecondary },
  categoryTextActive: { color: '#fff' },
  customTag: { fontSize: 9, color: colors.emerald, fontWeight: '600' },
  customTagActive: { color: 'rgba(255,255,255,0.7)' },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scanReceiptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, marginTop: 8 },
  scanReceiptBtnText: { color: colors.emerald, fontSize: 14, fontWeight: '500' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  checkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  checkMark: { color: '#fff', fontSize: 48, fontWeight: '700' },
  successTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 8 },
  successSub: { color: colors.textSecondary, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.card, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' },
  alertIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,59,48,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  alertTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  alertStats: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 14, width: '100%', marginBottom: 16 },
  alertStat: { flex: 1, alignItems: 'center' },
  alertStatDivider: { width: 0.5, backgroundColor: colors.border },
  alertStatLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  alertStatValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  alertSuggestion: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  alertPrimaryBtn: { width: '100%', backgroundColor: colors.emerald, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  alertPrimaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  alertSecondaryBtn: { width: '100%', padding: 12, alignItems: 'center' },
  alertSecondaryBtnText: { color: colors.textSecondary, fontSize: 14 },
  scanningOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  scanningCard: { backgroundColor: colors.card, borderRadius: 24, padding: 32, alignItems: 'center', width: '100%' },
  scanningTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  scanningText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
})