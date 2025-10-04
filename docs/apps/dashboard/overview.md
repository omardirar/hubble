# Dashboard Application

The Hubble Dashboard is a Next.js 15 application that provides the main user interface for the AI-powered marketing assistant platform.

## Overview

The dashboard serves as the central hub for users to interact with Hubble's features, including AI chat, data pipeline management, and organization settings. It's built with modern React patterns and provides a responsive, accessible user experience.

## Architecture

### Framework & Routing

- **Next.js 15**: App Router with Turbopack for fast development
- **React 19**: Latest React features with concurrent rendering
- **TypeScript**: Strict type checking for reliability
- **Tailwind CSS v4**: Utility-first styling with custom design system

### Key Features

- **Protected Routes**: Clerk-based authentication with organization context
- **Real-time Updates**: Server-Sent Events (SSE) for live data
- **Optimistic UI**: Immediate feedback with background synchronization
- **Responsive Design**: Mobile-first approach with adaptive layouts

## Project Structure

````text
apps/dashboard/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (protected)/        # Authenticated routes
│   │   │   ├── billing/        # Billing management
│   │   │   ├── chat/           # AI chat interface
│   │   │   ├── connect/        # Data pipeline setup
│   │   │   ├── dashboard/      # Main dashboard
│   │   │   ├── organization/   # Org management
│   │   │   ├── profile/        # User profile
│   │   │   ├── settings/       # Application settings
│   │   │   ├── support/        # Help & support
│   │   │   ├── team/           # Team management
│   │   │   └── workspace/      # Workspace settings
│   │   ├── api/                # API routes
│   │   │   ├── connect/        # Connect API endpoints
│   │   │   ├── v1/chat/        # Chat API v1
│   │   │   ├── motherduck/     # MotherDuck integration
│   │   │   └── queues/         # Background job queues
│   │   ├── sign-in/            # Authentication pages
│   │   ├── sign-up/
│   │   ├── healthz/            # Health check
│   │   ├── version/            # Version info
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing page
│   │   └── globals.css         # Global styles
│   ├── middleware.ts           # Next.js middleware
│   └── providers/              # React context providers
├── public/                     # Static assets
├── package.json               # Dependencies & scripts
├── next.config.ts             # Next.js configuration
├── tailwind.config.mjs        # Tailwind configuration
├── tsconfig.json              # TypeScript configuration
└── vercel.json                # Vercel deployment config
## Key Components

### Authentication & Authorization

- **Clerk Integration**: Seamless user authentication
- **JWT Tokens**: Secure API communication
- **Organization Context**: Multi-tenant data isolation
- **Protected Routes**: Automatic redirect for unauthenticated users

### Chat Interface

- **Real-time Messaging**: Live conversation updates
- **Message History**: Persistent conversation storage
- **AI Integration**: Anthropic Claude for intelligent responses
- **Optimistic UI**: Immediate message display with background sync

### Connect Pipeline

- **Data Source Management**: Connect to various data sources
- **MotherDuck Integration**: Per-tenant analytics databases
- **Fivetran Connectors**: Automated data pipeline setup
- **Real-time Status**: Live provisioning progress updates

### Dashboard Features

- **Analytics Overview**: Key metrics and insights
- **Organization Management**: Team and workspace settings
- **Billing Integration**: Subscription and usage tracking
- **Support System**: Help and feedback mechanisms

## API Routes

### Health & Status

- `GET /healthz` - Application health check
- `GET /version` - Version information

### Chat API (v1)

- `GET /api/v1/chat/conversations` - List conversations
- `POST /api/v1/chat/conversations` - Create conversation
- `PATCH /api/v1/chat/conversations/[id]` - Update conversation
- `GET /api/v1/chat/messages/[conversationId]` - List messages
- `POST /api/v1/chat/messages/[conversationId]` - Create message
- `POST /api/v1/chat` - Send AI chat request
- `POST /api/v1/chat/generate-title` - Generate conversation title

### Connect API

- `POST /api/connect/enable` - Start provisioning
- `GET /api/connect/status` - Check status
- `GET /api/connect/stream` - Real-time updates (SSE)
- `GET /api/connect/overview` - Connection overview
- `GET /api/connect/connector-types` - Available connectors
- `POST /api/connect/connector/create` - Create connector
- `GET /api/connect/connector/status` - Connector status
- `GET /api/connect/connections` - List connections

### MotherDuck Integration

- `POST /api/motherduck/create-database` - Create database

### Background Jobs

- `POST /api/queues/provision` - Queue provisioning job

## Development

### Prerequisites

- Node.js 20.10+ (< 25)
- pnpm 9.x+
- Environment variables configured

### Getting Started

1. **Install dependencies**

   ```bash
   pnpm install
````

2. **Set up environment variables**

    ```bash
    cp .env.example .env.local
    # Edit .env.local with your credentials
    ```

3. **Start development server**

    ```bash
    pnpm dev
    ```

4. **Open application**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Available Scripts

```bash
# Development
pnpm dev                    # Start development server with Turbopack
pnpm build                  # Build for production
pnpm start                  # Start production server

# Code Quality
pnpm lint                   # Run ESLint
pnpm typecheck             # TypeScript type checking
pnpm format:check          # Check Prettier formatting
```

### Environment Variables

Required environment variables for the dashboard:

````env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Upstash
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your-token
QSTASH_CURRENT_SIGNING_KEY=your-key
QSTASH_NEXT_SIGNING_KEY=your-next-key

UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
UPSTASH_REDIS_WS_URL=wss://...upstash.io
UPSTASH_REDIS_WS_TOKEN=your-token

# Data Platform (Optional)
MD_ADMIN_TOKEN=your-motherduck-token
FIVETRAN_API_KEY=your-fivetran-key
FIVETRAN_API_SECRET=your-fivetran-secret

# AI Service (Optional)
ANTHROPIC_API_KEY=your-anthropic-key
## Deployment

### Vercel Deployment

The dashboard is configured for automatic deployment on Vercel:

1. **Production**: Deploys from `main` branch
2. **Preview**: Deploys from pull requests
3. **Configuration**: `vercel.json` contains deployment settings

### Build Configuration

- **Next.js 15**: Latest features with App Router
- **Turbopack**: Fast development builds
- **Static Generation**: Optimized for performance
- **Edge Runtime**: Global edge deployment

### Performance Optimizations

- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js Image component
- **Font Optimization**: Google Fonts with next/font
- **Bundle Analysis**: Built-in bundle analyzer

## Security

### Authentication

- **Clerk JWT**: Secure token-based authentication
- **Organization Scoping**: Multi-tenant data isolation
- **Route Protection**: Middleware-based access control

### API Security

- **CORS Configuration**: Proper cross-origin settings
- **Rate Limiting**: Built-in request limiting
- **Input Validation**: Zod schema validation
- **SQL Injection Prevention**: Parameterized queries

### Data Protection

- **Row Level Security**: Supabase RLS policies
- **Environment Variables**: Secure credential storage
- **HTTPS Only**: Enforced secure connections

## Testing

### Test Configuration

- **Vitest**: Fast unit testing framework
- **Testing Library**: React component testing
- **JSDOM**: Browser environment simulation

### Running Tests

```bash
pnpm test                    # Run all tests
pnpm test:watch             # Watch mode
pnpm test:coverage          # Coverage report
````

### Test Structure

- **Unit Tests**: Component and utility testing
- **Integration Tests**: API route testing
- **E2E Tests**: Full user workflow testing

## Troubleshooting

### Common Issues

1. **Build Failures**
    - Check TypeScript errors: `pnpm typecheck`
    - Verify environment variables
    - Clear Next.js cache: `rm -rf .next`

2. **Authentication Issues**
    - Verify Clerk configuration
    - Check JWT token validity
    - Ensure proper redirect URLs

3. **API Errors**
    - Check Supabase connection
    - Verify RLS policies
    - Review server logs

4. **Performance Issues**
    - Analyze bundle size
    - Check for memory leaks
    - Optimize images and fonts

### Debug Mode

Enable debug logging by setting:

```env
NODE_ENV=development
LOG_LEVEL=debug
## Contributing

When contributing to the dashboard:

1. **Follow Code Style**: Use Prettier and ESLint
2. **Write Tests**: Add tests for new features
3. **Update Documentation**: Keep docs current
4. **Type Safety**: Maintain TypeScript strict mode
5. **Performance**: Consider bundle size impact

## Related Documentation

- [API Documentation](../api/README.md)
- [Package Documentation](../../packages/README.md)
- [Database Schema](../../supabase/README.md)
- [Deployment Guide](../../deployment/README.md)
```
