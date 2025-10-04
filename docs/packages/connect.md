# @hubble/connect

Data pipeline provisioning and management system for the Hubble platform.

## Overview

The `@hubble/connect` package provides comprehensive data pipeline provisioning functionality, including MotherDuck database creation, Fivetran connector setup, and real-time status monitoring. It's designed to handle multi-tenant data infrastructure provisioning with robust error handling and monitoring.

## Installation

```bash
pnpm add @hubble/connect
```

## Exports

### Provisioning Operations

#### `processProvisionJob(payload)`

Execute the complete provisioning workflow.

```typescript
import { processProvisionJob } from "@hubble/connect"

const result = await processProvisionJob({
    correlation_id: "prov_123",
    org_id: "org_456",
    connector_types: ["facebook_ads", "google_ads"],
})
```

#### `insertProvisionRun(supabase, orgId, logger)`

Start a new provisioning run.

```typescript
import { insertProvisionRun } from "@hubble/connect"
import { createBrowserClient } from "@hubble/db"

const supabase = createBrowserClient({ authToken })
const run = await insertProvisionRun(supabase, orgId, logger)
```

#### `updateProvisionRun(supabase, runId, status, metadata, logger)`

Update the status of a provisioning run.

```typescript
import { updateProvisionRun } from "@hubble/connect"

await updateProvisionRun(
    supabase,
    runId,
    "running",
    {
        current_step: "Creating MotherDuck database",
        progress: 50,
    },
    logger,
)
```

#### `getProvisionRun(supabase, runId, logger)`

Get details of a provisioning run.

```typescript
import { getProvisionRun } from "@hubble/connect"

const run = await getProvisionRun(supabase, runId, logger)
```

### Stream Operations

#### `createProvisionStream(id)`

Create a Server-Sent Events stream for real-time updates.

```typescript
import { createProvisionStream } from "@hubble/connect"

const stream = createProvisionStream("prov_123")

stream.on("data", (data) => {
    console.log("Provisioning update:", data)
})

stream.on("error", (error) => {
    console.error("Stream error:", error)
})
```

### Client Utilities

#### MotherDuck Client

```typescript
import { MotherDuckClient } from "@hubble/connect"

const client = new MotherDuckClient({
    adminToken: process.env.MD_ADMIN_TOKEN,
})

// Create database
const database = await client.createDatabase("md_org_123")

// Create service account
const serviceAccount = await client.createServiceAccount("sa_org_123")

// Issue token
const token = await client.issueToken(serviceAccount.id)
```

#### Fivetran Client

```typescript
import { FivetranClient } from "@hubble/connect"

const client = new FivetranClient({
    apiKey: process.env.FIVETRAN_API_KEY,
    apiSecret: process.env.FIVETRAN_API_SECRET,
})

// Create destination
const destination = await client.createDestination({
    service: "motherduck",
    region: "us-east-1",
    time_zone_offset: "-8",
})

// Create connector
const connector = await client.createConnector({
    service: "facebook_ads",
    group_id: destination.id,
    config: {
        ad_account_id: "act_123456789",
    },
})
```

### Types

#### `ProvisionRun`

```typescript
interface ProvisionRun {
    correlation_id: string
    org_id: string
    status: "pending" | "running" | "ready" | "failed"
    md_db_name?: string
    md_sa_username?: string
    fivetran_destination_id?: string
    metadata?: Record<string, any>
    error_message?: string
    started_at?: string
    finished_at?: string
    created_at: string
    updated_at: string
}
```

#### `ProvisionJobPayload`

```typescript
interface ProvisionJobPayload {
    correlation_id: string
    org_id: string
    connector_types: ConnectorType[]
    retry_count?: number
    max_retries?: number
}
```

#### `ConnectorType`

```typescript
type ConnectorType = "facebook_ads" | "google_ads" | "tiktok_ads" | "linkedin_ads"
```

#### `ProvisionStatus`

```typescript
interface ProvisionStatus {
    correlation_id: string
    status: "pending" | "running" | "ready" | "failed"
    progress: number
    current_step: string
    started_at: string
    updated_at: string
    timeline: TimelineEvent[]
}

interface TimelineEvent {
    step: string
    status: "pending" | "running" | "completed" | "failed"
    timestamp: string
    message?: string
}
```

## Usage Examples

### Basic Provisioning

```typescript
import { insertProvisionRun, processProvisionJob, updateProvisionRun } from "@hubble/connect"
import { createBrowserClient } from "@hubble/db"
import { logger } from "@hubble/logger"

// Initialize Supabase client
const supabase = createBrowserClient({ authToken })

// Start provisioning
const run = await insertProvisionRun(supabase, orgId, logger)
console.log("Provisioning started:", run.correlation_id)

// Process the provisioning job
const result = await processProvisionJob({
    correlation_id: run.correlation_id,
    org_id: orgId,
    connector_types: ["facebook_ads", "google_ads"],
})

// Update status
await updateProvisionRun(
    supabase,
    run.correlation_id,
    "ready",
    {
        current_step: "Completed",
        progress: 100,
    },
    logger,
)
```

### Real-time Monitoring

```typescript
import { createProvisionStream } from "@hubble/connect"

function monitorProvisioning(correlationId) {
    const stream = createProvisionStream(correlationId)

    stream.on("data", (data) => {
        console.log("Status update:", data.status)
        console.log("Progress:", data.progress + "%")
        console.log("Current step:", data.current_step)
    })

    stream.on("error", (error) => {
        console.error("Provisioning failed:", error)
    })

    stream.on("complete", (result) => {
        console.log("Provisioning completed:", result)
    })

    return stream
}

// Start monitoring
const stream = monitorProvisioning("prov_123")

// Stop monitoring when done
setTimeout(() => {
    stream.close()
}, 300000) // 5 minutes
```

### Error Handling and Retry

```typescript
import { processProvisionJob, ProvisionJobFailedError } from "@hubble/connect"
import { logger } from "@hubble/logger"

async function provisionWithRetry(payload, maxRetries = 3) {
    let retryCount = 0

    while (retryCount < maxRetries) {
        try {
            const result = await processProvisionJob(payload)
            return result
        } catch (error) {
            retryCount++

            if (error instanceof ProvisionJobFailedError) {
                logger.warn(`Provisioning failed, retry ${retryCount}/${maxRetries}`, {
                    correlation_id: payload.correlation_id,
                    error: error.message,
                })

                if (retryCount >= maxRetries) {
                    throw error
                }

                // Wait before retry (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
            } else {
                throw error
            }
        }
    }
}
```

### Database Operations

```typescript
import { insertProvisionRun, getProvisionRun, updateProvisionRun } from "@hubble/connect"

async function manageProvisionRuns(supabase, logger) {
    // Create new run
    const run = await insertProvisionRun(supabase, "org_123", logger)

    // Update run status
    await updateProvisionRun(
        supabase,
        run.correlation_id,
        "running",
        {
            current_step: "Creating MotherDuck database",
            progress: 25,
        },
        logger,
    )

    // Get run details
    const runDetails = await getProvisionRun(supabase, run.correlation_id, logger)

    return runDetails
}
```

### MotherDuck Integration

```typescript
import { MotherDuckClient } from "@hubble/connect"

async function setupMotherDuck(orgId) {
    const client = new MotherDuckClient({
        adminToken: process.env.MD_ADMIN_TOKEN,
    })

    // Create database
    const database = await client.createDatabase(`md_${orgId}`)
    console.log("Database created:", database.name)

    // Create service account
    const serviceAccount = await client.createServiceAccount(`sa_${orgId}`)
    console.log("Service account created:", serviceAccount.username)

    // Issue token
    const token = await client.issueToken(serviceAccount.id)
    console.log("Token issued:", token.substring(0, 20) + "...")

    return {
        database_name: database.name,
        service_account: serviceAccount.username,
        token: token,
    }
}
```

### Fivetran Integration

```typescript
import { FivetranClient } from "@hubble/connect"

async function setupFivetran(orgId, connectors) {
    const client = new FivetranClient({
        apiKey: process.env.FIVETRAN_API_KEY,
        apiSecret: process.env.FIVETRAN_API_SECRET,
    })

    // Create destination
    const destination = await client.createDestination({
        service: "motherduck",
        region: "us-east-1",
        time_zone_offset: "-8",
        config: {
            database: `md_${orgId}`,
            host: "motherduck.com",
            port: 443,
            user: `sa_${orgId}`,
            password: "token_here",
        },
    })

    // Create connectors
    const connectorResults = []
    for (const connectorType of connectors) {
        const connector = await client.createConnector({
            service: connectorType,
            group_id: destination.id,
            config: getConnectorConfig(connectorType),
        })
        connectorResults.push(connector)
    }

    return {
        destination_id: destination.id,
        connectors: connectorResults,
    }
}
```

## Database Schema

### Provisioning Workflows Table

```sql
CREATE TABLE core.provisioning_workflows (
  correlation_id UUID PRIMARY KEY,
  org_id TEXT NOT NULL,
  status workflow_status NOT NULL,
  md_db_name TEXT,
  md_sa_username TEXT,
  fivetran_destination_id TEXT,
  metadata JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE workflow_status AS ENUM (
  'pending', 'running', 'ready', 'failed'
);
```

### Data Destinations Table

```sql
CREATE TABLE connect.data_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  md_db_name TEXT NOT NULL,
  md_token_ref TEXT,
  fivetran_destination_id TEXT,
  status destination_status NOT NULL,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id)
);

CREATE TYPE destination_status AS ENUM (
  'pending', 'healthy', 'unhealthy'
);
```

### Data Connections Table

```sql
CREATE TABLE connect.data_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  fivetran_connector_id TEXT,
  schema_name TEXT,
  status connection_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, source_type)
);

CREATE TYPE connection_status AS ENUM (
  'not_configured', 'needs_auth', 'syncing',
  'healthy', 'paused', 'error'
);
```

## Security Considerations

### Authentication

- **MotherDuck Tokens**: Secure token-based authentication
- **Fivetran API Keys**: Encrypted API key storage
- **Organization Scoping**: All operations scoped to organizations
- **Token Rotation**: Regular token rotation for security

### Data Protection

- **Encryption**: All sensitive data encrypted at rest
- **Access Control**: Role-based access control
- **Audit Logging**: Comprehensive audit trail
- **Secret Management**: Secure credential storage

### Error Handling

- **Graceful Degradation**: Handle service failures gracefully
- **Retry Logic**: Exponential backoff retry mechanism
- **Error Recovery**: Automatic error recovery where possible
- **Monitoring**: Real-time error monitoring and alerting

## Performance Optimization

### Database Indexes

```sql
-- Provisioning workflows indexes
CREATE INDEX idx_provisioning_workflows_org_id ON core.provisioning_workflows(org_id);
CREATE INDEX idx_provisioning_workflows_status ON core.provisioning_workflows(status);
CREATE INDEX idx_provisioning_workflows_created_at ON core.provisioning_workflows(created_at);

-- Data destinations indexes
CREATE INDEX idx_data_destinations_org_id ON connect.data_destinations(org_id);
CREATE INDEX idx_data_destinations_status ON connect.data_destinations(status);

-- Data connections indexes
CREATE INDEX idx_data_connections_org_id ON connect.data_connections(org_id);
CREATE INDEX idx_data_connections_status ON connect.data_connections(status);
```

### Caching Strategy

- **Provision Status**: Cache provisioning status with TTL
- **Connection Health**: Cache connection health status
- **Metadata**: Cache frequently accessed metadata

### Async Processing

- **Background Jobs**: Use QStash for background processing
- **Queue Management**: Implement proper queue management
- **Dead Letter Queues**: Handle failed jobs appropriately

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from "vitest"
import { processProvisionJob, insertProvisionRun } from "@hubble/connect"

describe("@hubble/connect", () => {
    describe("processProvisionJob", () => {
        it("should process provisioning job successfully", async () => {
            const payload = {
                correlation_id: "prov_123",
                org_id: "org_456",
                connector_types: ["facebook_ads"],
            }

            const result = await processProvisionJob(payload)

            expect(result.status).toBe("ready")
            expect(result.md_db_name).toBeDefined()
            expect(result.fivetran_destination_id).toBeDefined()
        })

        it("should handle provisioning errors", async () => {
            const payload = {
                correlation_id: "prov_123",
                org_id: "invalid_org",
                connector_types: ["facebook_ads"],
            }

            await expect(processProvisionJob(payload)).rejects.toThrow("Organization not found")
        })
    })
})
```

### Integration Tests

```typescript
import { describe, it, expect } from "vitest"
import { createBrowserClient } from "@hubble/db"
import { insertProvisionRun, getProvisionRun } from "@hubble/connect"

describe("Connect Integration", () => {
    it("should perform CRUD operations", async () => {
        const supabase = createBrowserClient({ authToken: "test-token" })

        // Create provision run
        const run = await insertProvisionRun(supabase, "org_123", logger)
        expect(run.correlation_id).toBeDefined()
        expect(run.org_id).toBe("org_123")

        // Get provision run
        const retrievedRun = await getProvisionRun(supabase, run.correlation_id, logger)
        expect(retrievedRun.correlation_id).toBe(run.correlation_id)
    })
})
```

## Migration Guide

### From v0.x to v1.x

1. **Function Names**: Update function imports
2. **Error Handling**: Use new error classes
3. **Type Definitions**: Update type imports

```typescript
// Before (v0.x)
import { startProvisioning, getProvisionStatus } from "@hubble/connect"

// After (v1.x)
import { insertProvisionRun, getProvisionRun } from "@hubble/connect"
```

## Troubleshooting

### Common Issues

1. **Provisioning Failures**

- Check MotherDuck token validity
- Verify Fivetran API credentials
- Review organization permissions
- Check network connectivity

2. **Stream Connection Issues**

- Verify Redis WebSocket credentials
- Check network connectivity
- Review stream configuration
- Monitor connection logs

3. **Database Errors**

- Check Supabase connection
- Verify RLS policies
- Review database permissions
- Check query performance

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
CONNECT_DEBUG=true
```

## Contributing

When contributing to `@hubble/connect`:

1. **Follow Patterns**: Maintain consistency with existing code
2. **Add Tests**: Include comprehensive tests for new functionality
3. **Update Types**: Ensure TypeScript types are accurate
4. **Document Changes**: Update this documentation for new features

## Related Packages

- [**@hubble/db**](./db.md) - Database client factories
- [**@hubble/infrastructure**](./infrastructure.md) - Queue and Redis services
- [**@hubble/core**](./core.md) - Core utilities and error handling
- [**@hubble/types**](./types.md) - Shared TypeScript types
