import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { colors } from './theme'

import LoginScreen from './screens/LoginScreen'
import LoadingScreen from './screens/LoadingScreen'
import AccountsScreen from './screens/AccountsScreen'
import AccountDetailScreen from './screens/AccountDetailScreen'
import AddAccountScreen from './screens/AddAccountScreen'
import TransactionsScreen from './screens/TransactionsScreen'
import AddTransactionScreen from './screens/AddTransactionScreen'
import EditTransactionScreen from './screens/EditTransactionScreen'
import ReportsScreen from './screens/ReportsScreen'
import TaxScreen from './screens/TaxScreen'
import BudgetScreen from './screens/BudgetScreen'
import ProfileScreen from './screens/ProfileScreen'
import FinancialSummaryScreen from './screens/FinancialSummaryScreen'
import RecurringTransactionsScreen from './screens/RecurringTransactionsScreen'

const Tab = createBottomTabNavigator()
const Stack = createStackNavigator()

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.dark,
          borderTopColor: colors.borderDark,
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        tabBarActiveTintColor: colors.emerald,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarLabelStyle: { fontSize: 10, marginTop: 2 },
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            Accounts: focused ? 'wallet' : 'wallet-outline',
            Transactions: focused ? 'list' : 'list-outline',
            Add: focused ? 'add-circle' : 'add-circle-outline',
            Budget: focused ? 'calculator' : 'calculator-outline',
            Reports: focused ? 'bar-chart' : 'bar-chart-outline',
          }
          return <Ionicons name={icons[route.name]} size={focused ? 24 : 22} color={color} />
        },
      })}
    >
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Add" component={AddTransactionScreen} />
      <Tab.Screen name="Budget" component={BudgetScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
    </Tab.Navigator>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (loading) return <LoadingScreen />
  if (!session) return <LoginScreen />

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen
          name="AccountDetail"
          component={AccountDetailScreen}
        />
        <Stack.Screen
          name="AddAccount"
          component={AddAccountScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="EditTransaction"
          component={EditTransactionScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="FinancialSummary"
          component={FinancialSummaryScreen}
        />
        <Stack.Screen
          name="RecurringTransactions"
          component={RecurringTransactionsScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}