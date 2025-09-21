# Clerk Schema Switching

This document explains how the Clerk mirror schema switching works in the Hubble project.

## Overview

The project supports two Clerk schemas:

- `clerk` - Production schema
- `clerk_dev` - Development/Preview schema

The system automatically selects the appropriate schema based on the environment.

## How It Works

### Environment Detection

The system detects the environment using:

- `NODE_ENV === 'development'` → Uses `clerk_dev` schema
- `VERCEL_ENV === 'preview'` → Uses `clerk_dev` schema
- All other cases → Uses `clerk` schema

### Database Functions

All database functions that reference Clerk tables use dynamic schema selection:

```sql
-- Example from get_org_from_clerk_mirror function
if current_setting('app.environment', true) in ('development', 'preview') or
   current_setting('app.environment', true) is null then
  v_schema_name := 'clerk_dev';
else
  v_schema_name := 'clerk';
end if;
```

### Application Code

The application code uses utility functions to get the correct table names:

```typescript
import { getClerkTableName } from "@hubble/utils"

// This will return 'clerk_dev.organizations' in dev/preview
// and 'clerk.organizations' in production
const tableName = getClerkTableName("organizations")
```

## Schema Setup

Both schemas are created during migration:

1. **Migration 04**: Creates both `clerk` and `clerk_dev` schemas with identical structure
2. **Migration 05**: Sets up environment variable handling

## Default Behavior

- **Development**: Uses `clerk_dev` schema (default when environment is not set)
- **Preview**: Uses `clerk_dev` schema
- **Production**: Uses `clerk` schema

## Manual Override

To manually set the environment variable in the database:

```sql
SELECT set_config('app.environment', 'production', false);
-- or
SELECT set_config('app.environment', 'development', false);
```

## Files Modified

### Database Migrations

- `supabase/migrations/04_create_clerk_fdw.sql` - Creates both schemas and environment-aware functions
- `supabase/migrations/02_connect_schema.sql` - Updates tenant functions for schema switching
- `supabase/migrations/05_set_environment_variable.sql` - Environment variable utilities

### Application Code Changed

- `packages/utils/src/clerk-schema.ts` - Environment detection utilities
- `packages/utils/src/api-handlers.ts` - Updated to use dynamic RPC names
- `packages/auth/src/getOrgId.ts` - Updated to use dynamic table names
- `packages/db/src/client.ts` - Updated with schema switching notes
- `packages/db/src/server.ts` - Updated with schema switching notes

## Testing

To test the schema switching:

1. **Development**: Set `NODE_ENV=development` - should use `clerk_dev`
2. **Preview**: Set `VERCEL_ENV=preview` - should use `clerk_dev`
3. **Production**: Set `NODE_ENV=production` - should use `clerk`

The system will automatically log which schema is being used in the database functions.
