import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

function firstConfiguredKey(jsonValue: string | undefined) {
  if (!jsonValue) return ''
  try {
    const parsed = JSON.parse(jsonValue)
    if (typeof parsed.default === 'string') return parsed.default
    const value = Object.values(parsed).find(item => typeof item === 'string')
    return typeof value === 'string' ? value : ''
  } catch (_) {
    return ''
  }
}

const ADMIN_KEY =
  Deno.env.get('SUPABASE_SECRET_KEY') ||
  firstConfiguredKey(Deno.env.get('SUPABASE_SECRET_KEYS')) ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  ''

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)

const supabaseAdmin = createClient(SUPABASE_URL, ADMIN_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

function cors(origin: string | null) {
  const local =
    origin?.startsWith('http://127.0.0.1:') ||
    origin?.startsWith('http://localhost:')
  const allowed = !origin || local || allowedOrigins.includes(origin)
  return {
    allowed,
    headers: {
      'Access-Control-Allow-Origin': allowed && origin ? origin : 'null',
      'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin'
    }
  }
}

function json(status: number, body: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  })
}

async function requireCaller(authorization: string) {
  if (!authorization.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length)
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  return error ? null : data.user
}

async function requireOwner(userId: string, organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || data?.role !== 'owner') throw new Error('forbidden')
}

async function organizationMembers(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id,role,module_permissions,access_status')
    .eq('organization_id', organizationId)

  if (error) throw error
  return data ?? []
}

Deno.serve(async request => {
  const origin = request.headers.get('origin')
  const access = cors(origin)

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: access.allowed ? 204 : 403,
      headers: access.headers
    })
  }
  if (!access.allowed) return json(403, { error: 'origin_not_allowed' }, access.headers)
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, access.headers)
  if (!SUPABASE_URL || !ADMIN_KEY) return json(500, { error: 'server_not_configured' }, access.headers)

  try {
    const caller = await requireCaller(request.headers.get('authorization') ?? '')
    if (!caller) return json(401, { error: 'unauthorized' }, access.headers)

    const body = await request.json()
    const organizationId = String(body.organization_id || '')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
      return json(400, { error: 'invalid_organization' }, access.headers)
    }

    await requireOwner(caller.id, organizationId)
    const members = await organizationMembers(organizationId)
    const memberById = new Map(members.map(member => [member.user_id, member] as const))

    if (body.action === 'list') {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (error) throw error

      const users = data.users
        .filter(user => memberById.has(user.id))
        .map(user => ({
          id: user.id,
          email: user.email ?? '',
          name: user.user_metadata?.name || user.user_metadata?.nome || '',
          role: memberById.get(user.id)?.role || 'member',
          permissions: memberById.get(user.id)?.module_permissions || {},
          access_status: memberById.get(user.id)?.access_status || 'active',
          active: (memberById.get(user.id)?.access_status || 'active') === 'active'
        }))

      return json(200, { users }, access.headers)
    }

    if (body.action === 'create') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const name = String(body.name || '').trim().slice(0, 100)
      const role = ['admin', 'member', 'viewer'].includes(body.role) ? body.role : 'member'
      const accessStatus = ['active', 'activation_pending', 'suspended'].includes(body.access_status)
        ? body.access_status
        : 'activation_pending'

      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
        return json(400, { error: 'invalid_user_data' }, access.headers)
      }

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      })
      if (createError || !created.user) throw createError || new Error('create_failed')

      const { error: membershipError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: created.user.id,
          role,
          access_status: accessStatus
        })

      if (membershipError) {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id)
        throw membershipError
      }
      if (accessStatus !== 'active') {
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(created.user.id, {
          ban_duration: 'none'
        })
        if (banError) throw banError
      }
      return json(201, { id: created.user.id }, access.headers)
    }

    const targetId = String(body.user_id || '')
    const target = memberById.get(targetId)
    if (!target) return json(404, { error: 'user_not_in_organization' }, access.headers)
    if (target.role === 'owner') return json(403, { error: 'owner_protected' }, access.headers)

    if (body.action === 'update_role') {
      const role = String(body.role || '')
      if (!['admin', 'member', 'viewer'].includes(role)) {
        return json(400, { error: 'invalid_role' }, access.headers)
      }
      const { error } = await supabaseAdmin
        .from('organization_members')
        .update({ role })
        .eq('organization_id', organizationId)
        .eq('user_id', targetId)
      if (error) throw error
      return json(200, { ok: true }, access.headers)
    }

    if (body.action === 'update_permissions') {
      const allowedModules = ['dashboard','orcamentos','agenda','clientes_catalogo','financeiro','despesas','equipe','fornecedores','estoque']
      const source = body.permissions && typeof body.permissions === 'object' ? body.permissions : {}
      const permissions: Record<string,string> = {}
      for (const module of allowedModules) {
        const level = String(source[module] || 'none')
        permissions[module] = ['none','view','edit'].includes(level) ? level : 'none'
      }
      const { error } = await supabaseAdmin
        .from('organization_members')
        .update({ module_permissions: permissions })
        .eq('organization_id', organizationId)
        .eq('user_id', targetId)
      if (error) throw error
      return json(200, { ok: true }, access.headers)
    }

    if (body.action === 'update_password') {
      const password = String(body.password || '')
      if (password.length < 8) return json(400, { error: 'weak_password' }, access.headers)
      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetId, { password })
      if (error) throw error
      return json(200, { ok: true }, access.headers)
    }

    if (body.action === 'set_access_status') {
      const accessStatus = String(body.access_status || '')
      if (!['active', 'activation_pending', 'suspended'].includes(accessStatus)) {
        return json(400, { error: 'invalid_access_status' }, access.headers)
      }
      const { error: membershipError } = await supabaseAdmin
        .from('organization_members')
        .update({ access_status: accessStatus })
        .eq('organization_id', organizationId)
        .eq('user_id', targetId)
      if (membershipError) throw membershipError

      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
        ban_duration: 'none'
      })
      if (error) throw error
      return json(200, { ok: true }, access.headers)
    }

    return json(400, { error: 'unknown_action' }, access.headers)
  } catch (error) {
    if (error instanceof Error && error.message === 'forbidden') {
      return json(403, { error: 'forbidden' }, access.headers)
    }
    return json(500, { error: 'operation_failed' }, access.headers)
  }
})
