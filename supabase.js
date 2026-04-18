import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL = 'https://vsuciamiwcvgwuzwukpm.supabase.co'
const SUPABASE_ANON_KEY = 'sb_secret_VgZBx_-Z3DWvG60EaJ_wrg_tK4hPIVD'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
  },  
})