import { supabase } from './supabase'

const LARGE_DEPOSIT_THRESHOLD = 5000

export const checkBudgetAlert = async (userId, category, newAmount) => {
  if (!category || !userId) return null

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0]
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split('T')[0]

  const { data: budget } = await supabase
    .from('budgets')
    .select('limit_amount')
    .eq('user_id', userId)
    .eq('category', category)
    .single()

  if (!budget) return null

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('category', category)
    .eq('type', 'expense')
    .gte('date', firstDay)
    .lte('date', lastDay)

  const previousTotal = (transactions || [])
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)

  const newTotal = previousTotal + parseFloat(newAmount)
  const limit = parseFloat(budget.limit_amount)

  if (newTotal > limit) {
    const overage = newTotal - limit
    const pct = Math.round((newTotal / limit) * 100)
    return {
      type: 'budget_exceeded',
      category,
      overage,
      newTotal,
      limit,
      pct,
      message: `You've exceeded your ${category} budget by $${overage.toFixed(2)} (${pct}% of your $${limit.toFixed(2)} limit this month).`,
    }
  }

  if (newTotal >= limit * 0.9 && previousTotal < limit * 0.9) {
    const remaining = limit - newTotal
    return {
      type: 'budget_warning',
      category,
      remaining,
      newTotal,
      limit,
      message: `You're almost at your ${category} budget limit — only $${remaining.toFixed(2)} remaining this month.`,
    }
  }

  return null
}

export const checkLargeDepositAlert = (amount) => {
  if (parseFloat(amount) >= LARGE_DEPOSIT_THRESHOLD) {
    return {
      type: 'large_deposit',
      amount: parseFloat(amount),
      message: `Nice deposit of $${parseFloat(amount).toLocaleString()}! A financial advisor could help you make the most of it.`,
    }
  }
  return null
}