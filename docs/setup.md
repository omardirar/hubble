# Development Setup Guide

This guide provides comprehensive instructions for setting up the Hubble development environment on your local machine.

## Prerequisites

### System Requirements

- **Operating System**: macOS, Linux, or Windows (WSL2 recommended for Windows)
- **Node.js**: Version 20.10+ (< 25)
- **pnpm**: Version 9.x+
- **Git**: Latest version
- **Docker**: For containerized services (optional)

### Required Accounts

- **GitHub**: For code repository access
- **Supabase**: For database services
- **Clerk**: For authentication services
- **Upstash**: For Redis and QStash services
- **Vercel**: For deployment (optional)
- **MotherDuck**: For analytics database (optional)
- **Fivetran**: For data pipelines (optional)
- **Anthropic**: For AI services (optional)

## Quick Start

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/omzification/hubble.git
cd hubble

# Add upstream remote
git remote add upstream https://github.com/omzification/hubble.git
```

### 2. Install Dependencies

```bash
# Install all dependencies
pnpm install

# Verify installation
pnpm --version
node --version
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local  # or use your preferred editor
```

### 4. Start Development Server

```bash
# Start all services
pnpm dev

# Or start specific services
pnpm --filter @hubble/dashboard dev
```

### 5. Verify Setup

- Open [http://localhost:3000](http://localhost:3000)
- Check that the application loads without errors
- Verify all environment variables are properly configured

## Detailed Setup Instructions

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

#### Required Variables

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Upstash Services
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-current-key
QSTASH_NEXT_SIGNING_KEY=your-next-key

UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
UPSTASH_REDIS_WS_URL=wss://...upstash.io
UPSTASH_REDIS_WS_TOKEN=your-redis-ws-token
```

#### Optional Variables

```env
# Data Platform (for Connect feature)
MD_ADMIN_TOKEN=your-motherduck-token
FIVETRAN_API_KEY=your-fivetran-key
FIVETRAN_API_SECRET=your-fivetran-secret

# AI Services (for Chat feature)
ANTHROPIC_API_KEY=your-anthropic-key

# Development
NODE_ENV=development
LOG_LEVEL=debug
```

### Database Setup

#### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and API keys
4. Update your `.env.local` with the credentials

#### 2. Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push

# Verify schema
supabase db diff
```

#### 3. Set Up Row Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "conversations_org_isolation" ON public.conversations
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::text);

CREATE POLICY "messages_org_isolation" ON public.messages
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::text);
```

### Authentication Setup

#### 1. Create Clerk Application

1. Go to [clerk.com](https://clerk.com)
2. Create a new application
3. Configure organization settings
4. Set up redirect URLs:

- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

#### 2. Configure Clerk Settings

```javascript
// In your Clerk dashboard, configure:
// - Organization settings
// - User management
// - JWT templates with org_id claim
// - Redirect URLs
```

### External Services Setup

#### Upstash Redis & QStash

1. Go to [upstash.com](https://upstash.com)
2. Create Redis database
3. Create QStash project
4. Copy credentials to `.env.local`

#### MotherDuck (Optional)

1. Go to [motherduck.com](https://motherduck.com)
2. Create account and get admin token
3. Add token to `.env.local`

#### Fivetran (Optional)

1. Go to [fivetran.com](https://fivetran.com)
2. Create account and get API credentials
3. Add credentials to `.env.local`

#### Anthropic (Optional)

1. Go to [anthropic.com](https://anthropic.com)
2. Create account and get API key
3. Add key to `.env.local`

## Development Workflow

### Available Scripts

#### Root Level Scripts

```bash
# Development
pnpm dev                    # Start all applications
pnpm build                  # Build all packages
pnpm typecheck             # TypeScript type checking
pnpm lint                  # ESLint linting
pnpm test                  # Run test suite
pnpm format                # Format code with Prettier

# Package Management
pnpm install               # Install dependencies
pnpm update                # Update dependencies
pnpm clean                 # Clean build artifacts
```

#### Package-Specific Scripts

```bash
# Dashboard application
pnpm --filter @hubble/dashboard dev
pnpm --filter @hubble/dashboard build
pnpm --filter @hubble/dashboard test

# Individual packages
pnpm --filter @hubble/core build
pnpm --filter @hubble/auth test
pnpm --filter @hubble/db typecheck
```

#### MCP Development

```bash
# Start MotherDuck MCP server
pnpm mcp:dev:motherduck

# Start MCP Inspector
pnpm mcp:inspector:motherduck

# Python development
cd mcp/servers/motherduck
uv run python -m server --help
```

### Code Quality Tools

#### TypeScript Configuration

```json
{
    "compilerOptions": {
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "exactOptionalPropertyTypes": true
    }
}
```

#### ESLint Configuration

```json
{
    "extends": ["@hubble/eslint-config"],
    "rules": {
        "no-console": "warn",
        "prefer-const": "error"
    }
}
```

#### Prettier Configuration

```json
{
    "semi": true,
    "trailingComma": "es5",
    "singleQuote": true,
    "printWidth": 80,
    "tabWidth": 2
}
```

### Testing Setup

#### Unit Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test src/utils/generateId.test.ts
```

#### Integration Testing

```bash
# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e
```

#### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        coverage: {
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", "dist/"],
        },
    },
})
```

## IDE Setup

### Recommended VS Code Extensions

#### Essential Extensions

- **TypeScript**: Built-in TypeScript support
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Tailwind CSS IntelliSense**: Tailwind CSS support
- **GitLens**: Git integration
- **Thunder Client**: API testing

#### Additional Extensions

- **Auto Rename Tag**: HTML/JSX tag renaming
- **Bracket Pair Colorizer**: Bracket matching
- **Path Intellisense**: File path autocomplete
- **Import Cost**: Bundle size information
- **Error Lens**: Inline error display

### VS Code Settings

```json
{
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true,
        "source.organizeImports": true
    },
    "typescript.preferences.importModuleSpecifier": "relative",
    "emmet.includeLanguages": {
        "typescript": "html",
        "typescriptreact": "html"
    },
    "tailwindCSS.includeLanguages": {
        "typescript": "html",
        "typescriptreact": "html"
    }
}
```

### Workspace Configuration

```json
{
    "folders": [
        {
            "path": "."
        }
    ],
    "settings": {
        "typescript.preferences.includePackageJsonAutoImports": "auto",
        "editor.tabSize": 2,
        "editor.insertSpaces": true
    },
    "extensions": {
        "recommendations": [
            "ms-vscode.vscode-typescript-next",
            "esbenp.prettier-vscode",
            "bradlc.vscode-tailwindcss",
            "ms-vscode.vscode-json"
        ]
    }
}
```

## Database Development

### Local Database Setup

```bash
# Start local Supabase
supabase start

# Apply migrations
supabase db push

# Reset database
supabase db reset

# Stop local Supabase
supabase stop
```

### Database Schema Management

```bash
# Generate migration from schema changes
supabase db diff --schema public > migrations/new_migration.sql

# Apply specific migration
supabase db push --file migrations/specific_migration.sql

# Check migration status
supabase migration list
```

### Database Seeding

```bash
# Seed development data
pnpm db:seed

# Seed specific data
pnpm db:seed:users
pnpm db:seed:organizations
```

## Troubleshooting

### Common Issues

#### 1. Node.js Version Issues

```bash
# Check Node.js version
node --version

# Use correct version with nvm
nvm use 20.10.0

# Or install specific version
nvm install 20.10.0
```

#### 2. pnpm Installation Issues

```bash
# Install pnpm globally
npm install -g pnpm

# Or use corepack
corepack enable
corepack prepare pnpm@latest --activate
```

#### 3. Environment Variable Issues

```bash
# Check if variables are loaded
node -e "console.log(process.env.SUPABASE_URL)"

# Verify .env.local exists
ls -la .env.local

# Check for typos in variable names
grep -n "SUPABASE" .env.local
```

#### 4. Database Connection Issues

```bash
# Test Supabase connection
pnpm db:test

# Check Supabase status
supabase status

# Verify RLS policies
supabase db diff
```

#### 5. Build Issues

```bash
# Clear all caches
pnpm clean
rm -rf node_modules
rm -rf .next
rm -rf .turbo

# Reinstall dependencies
pnpm install

# Rebuild
pnpm build
```

#### 6. TypeScript Issues

```bash
# Check TypeScript errors
pnpm typecheck

# Restart TypeScript server
# In VS Code: Ctrl+Shift+P -> "TypeScript: Restart TS Server"

# Clear TypeScript cache
rm -rf .tsbuildinfo
```

### Debug Mode

Enable debug logging:

```env
# In .env.local
LOG_LEVEL=debug
NODE_ENV=development
DEBUG=true
```

### Performance Issues

#### 1. Slow Development Server

```bash
# Use Turbopack for faster builds
pnpm dev --turbo

# Or disable source maps
NEXT_TELEMETRY_DISABLED=1 pnpm dev
```

#### 2. Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" pnpm dev

# Or use pnpm with specific memory
pnpm --node-options="--max-old-space-size=4096" dev
```

#### 3. Database Performance

```sql
-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Development Best Practices

### Code Organization

- **Follow the established folder structure**
- **Use TypeScript for all new code**
- **Write tests for new functionality**
- **Update documentation when making changes**

### Git Workflow

- **Create feature branches from main**
- **Use descriptive commit messages**
- **Run tests before committing**
- **Keep commits atomic and focused**

### Performance

- **Monitor bundle size**
- **Use lazy loading for large components**
- **Optimize database queries**
- **Cache frequently accessed data**

### Security

- **Never commit secrets to git**
- **Use environment variables for configuration**
- **Validate all user inputs**
- **Follow security best practices**

## Getting Help

### Documentation

- **README.md**: Project overview and quick start
- **docs/**: Comprehensive documentation
- **API docs**: Detailed API reference
- **Package docs**: Individual package documentation

### Community

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and discussions
- **Discord**: Real-time community chat
- **Stack Overflow**: Tag questions with `hubble`

### Support

- **Documentation**: Check docs first
- **Issues**: Search existing issues
- **Discussions**: Ask questions in discussions
- **Email**: Contact maintainers directly

## Next Steps

After completing the setup:

1. **Read the Architecture Guide**: Understand the system design
2. **Explore the API Documentation**: Learn about available endpoints
3. **Check out the Package Documentation**: Understand shared packages
4. **Run the Test Suite**: Ensure everything works correctly
5. **Start Contributing**: Pick an issue and start coding!

## Related Documentation

- [Architecture Guide](./architecture.md)
- [API Documentation](./api/README.md)
- [Package Documentation](./packages/README.md)
- [Database Schema](./supabase/README.md)
- [Contributing Guide](../CONTRIBUTING.md)
