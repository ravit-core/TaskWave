import { supabase } from '@/lib/supabase'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
    status: number
    body: unknown
    constructor(status: number, body: unknown, message: string) {
        super(message)
        this.status = status
        this.body = body
    }
}

async function getAccessToken(): Promise<string | null> {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
}

async function handle401() {
    if (typeof window === 'undefined') return
    await supabase?.auth.signOut()
    const next = window.location.pathname + window.location.search
    window.location.href = `/auth?redirect=${encodeURIComponent(next)}`
}

type Options = Omit<RequestInit, 'body'> & {
    body?: unknown
    auth?: boolean
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
    const { body, auth = true, headers, ...rest } = opts

    const finalHeaders = new Headers(headers)

    let finalBody: BodyInit | undefined
    if (body instanceof FormData) {
        finalBody = body
    } else if (body !== undefined) {
        finalHeaders.set('Content-Type', 'application/json')
        finalBody = JSON.stringify(body)
    }

    if (auth) {
        const token = await getAccessToken()
        if (token) finalHeaders.set('Authorization', `Bearer ${token}`)
    }

    const url = path.startsWith('http') ? path : `${BACKEND_URL}${path}`
    const res = await fetch(url, { ...rest, headers: finalHeaders, body: finalBody })

    if (res.status === 401) {
        await handle401()
        throw new ApiError(401, null, 'Unauthorized')
    }

    const contentType = res.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json') ? await res.json() : await res.text()

    if (!res.ok) {
        const msg = (payload as { detail?: string })?.detail || res.statusText || `HTTP ${res.status}`
        throw new ApiError(res.status, payload, msg)
    }

    return payload as T
}

