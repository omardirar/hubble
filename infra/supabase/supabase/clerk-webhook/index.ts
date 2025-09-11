// @ts-nocheck
// Deno runtime
import { Webhook } from "npm:svix"
import { createClient } from "npm:@supabase/supabase-js"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const CLERK_WEBHOOK_SECRET = Deno.env.get("CLERK_WEBHOOK_SECRET")

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CLERK_WEBHOOK_SECRET) {
  throw new Error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLERK_WEBHOOK_SECRET")
}

// Create service client with proper configuration
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
}).schema("clerk")
/* ───────────────────────────── utils ───────────────────────────── */ function toIso(ts) {
  if (ts == null) return null
  if (typeof ts === "number") return new Date(ts > 1e12 ? ts : ts * 1000).toISOString()
  if (typeof ts === "string") {
    const n = Number(ts)
    if (!Number.isNaN(n)) return new Date(n > 1e12 ? n : n * 1000).toISOString()
    const d = new Date(ts)
    return Number.isNaN(+d) ? null : d.toISOString()
  }
  if (ts instanceof Date) return ts.toISOString()
  return null
}
const objectType = (d) => d?.object ?? "unknown"
const objectId = (d) => d?.id
const userIdOf = (d) => d?.user_id ?? d?.public_user_data?.user_id ?? d?.user?.id ?? d?.actor?.id
const orgIdOf = (d) => d?.organization_id ?? d?.organization?.id
const synth = (...parts) => parts.filter(Boolean).join(":")
// Fail noisy on DB error (so logs show the exact cause)
async function must(p, ctx) {
  const { data, error } = await p
  if (error) {
    console.error(ctx, error) // shows message, details, hint, code in logs
    throw new Error(`${ctx}: ${error.message ?? JSON.stringify(error)}`)
  }
  return data
}
/* ─────────────────────── events & snapshots ─────────────────────── */ async function recordEvent(
  svixId,
  type,
  data,
) {
  await must(
    db.from("events").upsert(
      {
        svix_message_id: svixId,
        event_type: type,
        object_type: objectType(data),
        object_id: objectId(data),
        user_id: userIdOf(data),
        organization_id: orgIdOf(data),
        payload: data,
        occurred_at: toIso(data?.occurred_at ?? data?.updated_at ?? data?.created_at),
        received_at: new Date().toISOString(),
      },
      {
        onConflict: "svix_message_id",
      },
    ),
    "events.upsert",
  )
}
async function upsertRaw(data, tombstone = false) {
  const objType = objectType(data)
  const oid = objectId(data)
  if (!oid) return
  await must(
    db.from("raw_objects").upsert(
      {
        object_type: objType,
        object_id: oid,
        data,
        updated_at: toIso(data?.updated_at ?? data?.deleted_at ?? data?.created_at),
        synced_at: new Date().toISOString(),
        deleted_at: tombstone ? new Date().toISOString() : null,
      },
      {
        onConflict: "object_type,object_id",
      },
    ),
    tombstone ? "raw_objects.tombstone" : "raw_objects.upsert",
  )
}
/* ───────────────────── ensure parents (FK-safe) ─────────────────── */ async function ensureUser(
  uid,
) {
  if (!uid) return
  await must(
    db.from("users").upsert(
      {
        user_id: uid,
      },
      {
        onConflict: "user_id",
      },
    ),
    "ensureUser",
  )
}
async function ensureOrg(oid) {
  if (!oid) return
  await must(
    db.from("organizations").upsert(
      {
        organization_id: oid,
      },
      {
        onConflict: "organization_id",
      },
    ),
    "ensureOrg",
  )
}
/* ───────────────────────── typed upserts (PK-only onConflict) ───────────────────────── */ async function upsertUser(
  data,
) {
  await must(
    db.from("users").upsert(
      {
        user_id: data.id,
        username: data.username ?? null,
        first_name: data.first_name ?? null,
        last_name: data.last_name ?? null,
        image_url: data.image_url ?? null,
        primary_email_address_id: data.primary_email_address_id ?? null,
        primary_phone_number_id: data.primary_phone_number_id ?? null,
        primary_web3_wallet_id: data.primary_web3_wallet_id ?? null,
        public_metadata: data.public_metadata ?? {},
        private_metadata: data.private_metadata ?? {},
        unsafe_metadata: data.unsafe_metadata ?? {},
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    ),
    "users.upsert",
  )
}
async function upsertEmail(data) {
  await ensureUser(data.user_id)
  await must(
    db.from("email_addresses").upsert(
      {
        email_address_id: data.id,
        user_id: data.user_id,
        email_address: data.email_address,
        is_primary_for_user: data.is_primary ?? data.id === data.user?.primary_email_address_id,
        verification_status: data.verification?.status ?? data.verification_status ?? null,
        verification: data.verification ?? {},
        linked_to: Array.isArray(data.linked_to) ? data.linked_to : [],
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "email_address_id",
      },
    ),
    "email_addresses.upsert",
  )
}
async function upsertPhone(data) {
  await ensureUser(data.user_id)
  await must(
    db.from("phone_numbers").upsert(
      {
        phone_number_id: data.id,
        user_id: data.user_id,
        phone_number: data.phone_number,
        is_primary_for_user: data.is_primary ?? data.id === data.user?.primary_phone_number_id,
        verification_status: data.verification?.status ?? data.verification_status ?? null,
        verification: data.verification ?? {},
        reserved_for_second_factor: data.reserved_for_second_factor ?? null,
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "phone_number_id",
      },
    ),
    "phone_numbers.upsert",
  )
}
async function upsertWallet(data) {
  await ensureUser(data.user_id)
  await must(
    db.from("web3_wallets").upsert(
      {
        web3_wallet_id: data.id,
        user_id: data.user_id,
        address: data.web3_wallet?.address ?? data.address ?? null,
        verification_status: data.verification?.status ?? data.verification_status ?? null,
        verification: data.verification ?? {},
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "web3_wallet_id",
      },
    ),
    "web3_wallets.upsert",
  )
}
async function upsertExternalAccount(data) {
  await ensureUser(data.user_id)
  await must(
    db.from("external_accounts").upsert(
      {
        external_account_id: data.id,
        user_id: data.user_id,
        provider: data.provider ?? null,
        provider_user_id: data.provider_user_id ?? null,
        approved_scopes: data.approved_scopes ?? null,
        email_address: data.email_address ?? null,
        username: data.username ?? null,
        first_name: data.first_name ?? null,
        last_name: data.last_name ?? null,
        picture_url: data.picture_url ?? null,
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "external_account_id",
      },
    ),
    "external_accounts.upsert",
  )
}
async function upsertSession(data) {
  await ensureUser(data.user_id)
  await must(
    db.from("sessions").upsert(
      {
        session_id: data.id,
        user_id: data.user_id,
        status: data.status ?? null,
        client_id: data.client_id ?? null,
        last_active_at: toIso(data.last_active_at),
        expires_at: toIso(data.expire_at ?? data.expires_at),
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "session_id",
      },
    ),
    "sessions.upsert",
  )
}
async function upsertOrganization(data) {
  await must(
    db.from("organizations").upsert(
      {
        organization_id: data.id,
        name: data.name ?? null,
        slug: data.slug ?? null,
        image_url: data.image_url ?? null,
        max_allowed_memberships: data.max_allowed_memberships ?? null,
        members_count: data.members_count ?? null,
        public_metadata: data.public_metadata ?? {},
        private_metadata: data.private_metadata ?? {},
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id",
      },
    ),
    "organizations.upsert",
  )
}
async function upsertMembership(data) {
  const orgId = data.organization?.id ?? data.organization_id
  const uId = data.public_user_data?.user_id ?? data.user_id
  await ensureOrg(orgId)
  await ensureUser(uId)
  // Always use PK-only conflict; synthesize when Clerk id missing
  const membership_id = data.id ?? synth("membership", orgId, uId)
  await must(
    db.from("organization_memberships").upsert(
      {
        membership_id,
        organization_id: orgId,
        user_id: uId,
        role: data.role ?? null,
        public_metadata: data.public_metadata ?? {},
        private_metadata: data.private_metadata ?? {},
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "membership_id",
      },
    ),
    "organization_memberships.upsert",
  )
}
async function upsertInvitation(data) {
  const orgId = data.organization_id ?? data.organization?.id
  await ensureOrg(orgId)
  await must(
    db.from("organization_invitations").upsert(
      {
        invitation_id: data.id,
        organization_id: orgId,
        email_address: data.email_address ?? data.email_address_to_invite ?? null,
        role: data.role ?? null,
        inviter_user_id: data.inviter_user_id ?? data.created_by ?? null,
        status: data.status ?? null,
        public_metadata: data.public_metadata ?? {},
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "invitation_id",
      },
    ),
    "organization_invitations.upsert",
  )
}
async function upsertClient(data) {
  if (data.user_id) await ensureUser(data.user_id)
  await must(
    db.from("clients").upsert(
      {
        client_id: data.id,
        user_id: data.user_id ?? null,
        last_active_at: toIso(data.last_active_at),
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        metadata: data.meta ?? data.metadata ?? {},
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "client_id",
      },
    ),
    "clients.upsert",
  )
}
async function upsertOrgDomain(data) {
  const orgId = data.organization_id ?? data.organization?.id
  await ensureOrg(orgId)
  const name = data.name ?? data.domain ?? "unknown"
  const organization_domain_id = data.id ?? synth("orgdomain", orgId, name)
  await must(
    db.from("organization_domains").upsert(
      {
        organization_domain_id,
        organization_id: orgId,
        name,
        verification: data.verification ?? {},
        created_at: toIso(data.created_at),
        updated_at: toIso(data.updated_at),
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_domain_id",
      },
    ),
    "organization_domains.upsert",
  )
}
/* ───────────────────────── deletions + tombstone ───────────────────────── */ async function handleDeletion(
  eventType,
  data,
) {
  const objType = objectType(data)
  const id = objectId(data)
  if (!id) return
  const del = (table, col, val) => must(db.from(table).delete().eq(col, val), `delete ${table}`)
  switch (objType) {
    case "user":
      await del("users", "user_id", id)
      break
    case "organization":
      await del("organizations", "organization_id", id)
      break
    case "organization_membership":
      await del("organization_memberships", "membership_id", id)
      break
    case "organization_invitation":
      await del("organization_invitations", "invitation_id", id)
      break
    case "session":
      await del("sessions", "session_id", id)
      break
    case "email_address":
      await del("email_addresses", "email_address_id", id)
      break
    case "phone_number":
      await del("phone_numbers", "phone_number_id", id)
      break
    case "web3_wallet":
      await del("web3_wallets", "web3_wallet_id", id)
      break
    case "external_account":
      await del("external_accounts", "external_account_id", id)
      break
    case "client":
      await del("clients", "client_id", id)
      break
    case "organization_domain":
      await del("organization_domains", "organization_domain_id", id)
      break
    default:
      break
  }
  await upsertRaw(data, true) // tombstone raw snapshot
}
/* ───────────────────────────── router ───────────────────────────── */ async function route(
  eventType,
  data,
) {
  if (eventType.endsWith(".deleted")) {
    await handleDeletion(eventType, data)
    return
  }
  switch (objectType(data)) {
    case "user":
      await upsertUser(data)
      break
    case "email_address":
      await upsertEmail(data)
      break
    case "phone_number":
      await upsertPhone(data)
      break
    case "web3_wallet":
      await upsertWallet(data)
      break
    case "external_account":
      await upsertExternalAccount(data)
      break
    case "session":
      await upsertSession(data)
      break
    case "organization":
      await upsertOrganization(data)
      break
    case "organization_membership":
      await upsertMembership(data)
      break
    case "organization_invitation":
      await upsertInvitation(data)
      break
    case "client":
      await upsertClient(data)
      break
    case "organization_domain":
      await upsertOrgDomain(data)
      break
    default:
      break
  }
}
/* ───────────────────────────── serve ───────────────────────────── */ Deno.serve(async (req) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", {
      status: 405,
    })
  const id = req.headers.get("svix-id")
  const ts = req.headers.get("svix-timestamp")
  const sig = req.headers.get("svix-signature")
  if (!id || !ts || !sig)
    return new Response("Missing Svix headers", {
      status: 400,
    })
  const payload = await req.text()
  const wh = new Webhook(CLERK_WEBHOOK_SECRET)
  let evt
  try {
    evt = wh.verify(payload, {
      "svix-id": id,
      "svix-timestamp": ts,
      "svix-signature": sig,
    })
  } catch (e) {
    console.error("signature.verify", e)
    return new Response("Invalid signature", {
      status: 400,
    })
  }
  const type = evt?.type
  const data = evt?.data ?? evt
  if (!type || !data)
    return new Response("Malformed payload", {
      status: 400,
    })
  try {
    await recordEvent(id, type, data) // idempotent by svix id
    await route(type, data) // typed tables (or deletion)
    await upsertRaw(data, false) // latest snapshot (non-tombstone)
  } catch (e) {
    console.error("webhook.error", e)
    // diagnostic event with a distinct key (won't clobber the original event)
    await db.from("events").upsert(
      {
        svix_message_id: `${id}-error`,
        event_type: "webhook.error",
        object_type: objectType(data),
        object_id: objectId(data),
        user_id: userIdOf(data),
        organization_id: orgIdOf(data),
        payload: {
          error: String(e),
          originalType: type,
        },
        received_at: new Date().toISOString(),
      },
      {
        onConflict: "svix_message_id",
      },
    )
    return new Response("Internal Error", {
      status: 500,
    })
  }
  return new Response("ok", {
    status: 200,
  })
})
