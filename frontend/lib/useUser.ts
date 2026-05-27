'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api, ApiError } from '@/lib/api'

export type AuthProvider = 'email' | 'linkedin_oidc' | 'google' | string

export type UserProfile = {
    id: string
    email: string | null
    full_name: string | null
    avatar_url: string | null
    /** Primary identity provider — derived from supabase session.user.app_metadata.provider */
    provider: AuthProvider | null
}

export function useUser() {
    const router = useRouter()
    const [user, setUser] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    const loadProfile = useCallback(async () => {
        if (!supabase) {
            setUser(null)
            setLoading(false)
            return
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            setUser(null)
            setLoading(false)
            return
        }

        try {
            const profile = await api<Omit<UserProfile, 'provider'>>('/api/auth/me')
            const meta = session.user?.app_metadata as { provider?: string; providers?: string[] } | undefined
            const provider: AuthProvider | null = meta?.provider || meta?.providers?.[0] || null
            setUser({ ...profile, provider })
        } catch (err) {
            if (!(err instanceof ApiError) || err.status !== 401) {
                console.error('[useUser] Failed to load profile:', err)
            }
            setUser(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadProfile()

        if (!supabase) return
        const { data: sub } = supabase.auth.onAuthStateChange((_event: unknown, session: unknown) => {
            if (!session) {
                setUser(null)
                setLoading(false)
            } else {
                loadProfile()
            }
        })

        return () => sub.subscription.unsubscribe()
    }, [loadProfile])

    const signOut = useCallback(async () => {
        await supabase?.auth.signOut()
        setUser(null)
        router.push('/')
        router.refresh()
    }, [router])

    return { user, loading, signOut }
}
