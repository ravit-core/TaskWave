import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!url || !key) {
  console.warn(
    '[TaskWave] Supabase env vars not set. Create frontend/.env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = (url && key) ? createBrowserClient(url, key) : (null as any)
