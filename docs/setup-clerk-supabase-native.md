# Clerk-Supabase Native Integration Setup

This guide explains how to set up the native Clerk-Supabase integration in our API worker architecture, which is the recommended approach as of 2024, replacing the deprecated JWT template method.

## Architecture Overview

Our implementation uses a **proxy pattern** where:

- **Browser**: Uses `apiFetch` to call Next.js API routes
- **Next.js API Routes**: Proxy requests to API worker with Clerk JWT tokens
- **API Worker**: Uses native Clerk-Supabase integration for database operations
- **Supabase**: Enforces RLS policies based on Clerk JWT claims

```text
Browser → Next.js API Routes → API Worker → Supabase
```

## Benefits

The native integration provides:

- **Better Security**: No need to share JWT secrets with third parties
- **Easier Maintenance**: No JWT secret rotation issues
- **Better Performance**: No additional latency for JWT generation
- **Future-Proof**: Supported approach going forward
- **Centralized Auth**: All authentication logic in API worker
- **Enhanced Security**: No client-side Supabase credentials

## Prerequisites

- Clerk account with a configured application
- Supabase project with database schema set up
- Access to both Clerk and Supabase dashboards

## Step 1: Configure Clerk for Supabase Integration

### 1.1 Enable Native Integration

1. In your Clerk Dashboard, navigate to **Integrations**
2. Find **Supabase** in the available integrations
3. Click **Connect** and follow the setup wizard
4. This automatically configures your Clerk instance for Supabase compatibility

### 1.2 Verify JWT Claims

The integration automatically adds the required `role: "authenticated"` claim to all session tokens. No manual JWT template configuration is needed.

## Step 2: Configure Supabase for Clerk Integration

### 2.1 Add Clerk as Third-Party Auth Provider

1. In your Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Clerk** in the third-party providers list
3. Click **Enable** and enter your Clerk domain (e.g., `your-app.clerk.accounts.dev`)
4. Save the configuration

### 2.2 Verify JWT Settings

Supabase will automatically configure JWT validation using Clerk's JWKS endpoint. No manual JWT secret configuration is needed.

## Step 3: Update Database Schema

### 3.1 RLS Policies

Update your RLS policies to use the correct JWT claim structure:

```sql
-- Example policy for conversations table
create policy "Users can access their organization's conversations"
on public.conversations
for all
to authenticated
using (
  owner_user_id = auth.jwt()->>'sub'
  and org_id = coalesce(
    auth.jwt()->>'org_id',
    auth.jwt()->'o'->>'id'
  )
);
```

### 3.2 Helper Functions

Update database functions to access organization data correctly:

```sql
-- Update current_org_id function
create or replace function public.current_org_id()
returns text
language sql
stable
as $fn$
  select coalesce(
    auth.jwt()->>'org_id',
    auth.jwt()->'o'->>'id'
  )
$fn$;
```

## Step 4: Update Application Code

### 4.1 Browser Code (No Direct Supabase Access)

The browser uses `apiFetch` to communicate with Next.js API routes:

```typescript
// ✅ CORRECT: Use apiFetch for all database operations
const response = await apiFetch("/api/v1/chat/conversations", {
  method: "GET",
  headers: { Authorization: `Bearer ${clerkToken}` },
})
```

### 4.2 Next.js API Routes (Proxy Pattern)

API routes proxy requests to the API worker:

```typescript
// ✅ CORRECT: Proxy to API worker with Clerk JWT
export async function GET() {
  const { getToken } = await auth()
  const token = await getToken() // Native integration, no template needed
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const response = await fetch(`${apiUrl}/v1/chat/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response
}
```

### 4.3 API Worker (Native Integration)

The API worker uses the native Clerk-Supabase integration:

```typescript
// ✅ CORRECT: Use native integration in API worker
const supabase = await createBrowserClientWithFallback(env, { authToken: token })
const { data } = await supabase.from("chat.conversations").select("*")
```

### 4.4 Environment Variables

**Browser**: No Supabase environment variables needed
**API Worker**: Uses Secrets Store for Supabase credentials

## Step 5: Test the Integration

### 5.1 Verify Authentication

1. Sign in to your application
2. Check that the Supabase client can access user data
3. Verify that RLS policies are working correctly

### 5.2 Test Organization Access

1. Create test data with different organization IDs
2. Verify users can only access their organization's data
3. Test organization switching if applicable

## Migration from JWT Template Method

If you're migrating from the deprecated JWT template method:

### Remove JWT Template Configuration

1. Delete any custom JWT templates in Clerk Dashboard
2. Remove JWT secret sharing between Clerk and Supabase
3. Update all RLS policies to use `auth.jwt()` instead of `public.jwt_claim()`

### Update Client Code

1. Replace manual JWT token passing with `useSupabaseWithClerk`
2. Remove any custom JWT token management code
3. Update API routes to use the native integration

## Troubleshooting

### Common Issues

1. **"Invalid JWT" errors**: Ensure Clerk domain is correctly configured in Supabase
2. **RLS policy failures**: Verify JWT claim structure matches your policies
3. **Organization data not accessible**: Check that organization claims are present in JWT

### Debug JWT Claims

You can inspect JWT claims in your browser's developer tools:

```javascript
// In browser console
const token = await session.getToken()
const payload = JSON.parse(atob(token.split(".")[1]))
console.log(payload)
```

## Best Practices

1. **Use RLS Policies**: Always secure data access with Row Level Security
2. **Test Thoroughly**: Verify all user flows work with the new integration
3. **Monitor Performance**: The native integration should be faster than JWT templates
4. **Keep Updated**: Follow Clerk and Supabase updates for integration improvements

## Support

- [Clerk Supabase Integration Docs](https://clerk.com/docs/integrations/databases/supabase)
- [Supabase Third-Party Auth Docs](https://supabase.com/docs/guides/auth/third-party/clerk)
- [Clerk Community Discord](https://discord.gg/clerk)
- [Supabase Community Discord](https://discord.supabase.com)
