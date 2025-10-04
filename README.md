# Hubble

![Hubble - AI-powered Marketing Assistant](docs/assets/banner.png)

[![Build Status](https://img.shields.io/github/actions/workflow/status/omzification/hubble/ci.yml?branch=main&style=flat-square)](https://github.com/omzification/hubble/actions)
[![License](https://img.shields.io/github/license/omzification/hubble?style=flat-square)](https://github.com/omzification/hubble/blob/main/LICENSE)
[![Version](https://img.shields.io/github/v/release/omzification/hubble?style=flat-square)](https://github.com/omzification/hubble/releases)
[![Contributors](https://img.shields.io/github/contributors/omzification/hubble?style=flat-square)](https://github.com/omzification/hubble/graphs/contributors)
[![Open Issues](https://img.shields.io/github/issues/omzification/hubble?style=flat-square)](https://github.com/omzification/hubble/issues)
[![Last Commit](https://img.shields.io/github/last-commit/omzification/hubble?style=flat-square)](https://github.com/omzification/hubble/commits/main)
[![Code Size](https://img.shields.io/github/languages/code-size/omzification/hubble?style=flat-square)](https://github.com/omzification/hubble)
[![Top Language](https://img.shields.io/github/languages/top/omzification/hubble?style=flat-square)](https://github.com/omzification/hubble)
[![Activity](https://img.shields.io/github/commit-activity/m/omzification/hubble?style=flat-square)](https://github.com/omzification/hubble/graphs/commit-activity)

> An AI-powered Marketing Assistant with a full-stack Next.js 15 application, featuring real-time chat capabilities and automated data pipeline provisioning for multi-tenant analytics.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/omzification/hubble.git
cd hubble

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Setup](#-environment-setup)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Overview

Hubble is a comprehensive AI-powered marketing assistant platform that provides:

- **Intelligent Chat Interface**: Real-time AI conversations with context-aware responses
- **Multi-tenant Data Pipeline**: Automated provisioning of MotherDuck databases and Fivetran destinations
- **Organization Management**: Clerk-based authentication with JWT-based organization context
- **Real-time Analytics**: Live data streaming and visualization capabilities
- **Scalable Architecture**: Built on modern serverless technologies

## 🏗 Architecture

Hubble follows a modern microservices architecture with clear separation of concerns:

```mermaid
graph TB
  subgraph "Frontend Layer"
      A[Next.js 15 Dashboard]
      B[React 19 Components]
      C[Tailwind CSS]
  end

  subgraph "API Layer"
      D[Next.js API Routes]
      E[Server Actions]
      F[Middleware]
  end

  subgraph "Business Logic"
      G[Chat Service]
      H[Connect Service]
      I[Auth Service]
  end

  subgraph "Data Layer"
      J[Supabase PostgreSQL]
      K[MotherDuck Analytics]
      L[Fivetran Pipelines]
  end

  subgraph "Infrastructure"
      M[Upstash QStash]
      N[Upstash Redis]
      O[Vercel Runtime]
  end

  A --> D
  B --> A
  C --> B
  D --> G
  D --> H
  D --> I
  G --> J
  H --> K
  H --> L
  I --> J
  G --> M
  H --> M
  M --> N
  D --> O
```

## ✨ Features

### 💬 AI Chat System

- **Multi-conversation Support**: Create and manage multiple chat sessions
- **Real-time Updates**: Live message streaming with optimistic UI
- **Message History**: Persistent conversation storage with RLS security
- **Idempotent Operations**: Duplicate message prevention
- **Archive Support**: Organize and manage conversation history

### 🔌 Connect Data Pipeline

- **Automated Provisioning**: One-click setup of data infrastructure
- **MotherDuck Integration**: Per-tenant database creation and management
- **Fivetran Connectors**: Automated data pipeline configuration
- **Real-time Status**: Live provisioning progress with SSE streams
- **Distributed Locking**: Prevents duplicate provisioning operations

### 🏢 Organization Management

- **Clerk Authentication**: Secure user and organization management
- **JWT-based Context**: Organization-scoped operations
- **Role-based Access**: Granular permission system
- **Multi-tenant Architecture**: Isolated data per organization

### 📊 Analytics & Monitoring

- **Real-time Dashboards**: Live data visualization
- **Performance Metrics**: Application and infrastructure monitoring
- **Error Tracking**: Comprehensive error logging and alerting
- **Audit Trails**: Complete operation history

## 🛠 Tech Stack

### Frontend

- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4
- **Components**: Radix UI primitives with shadcn/ui patterns
- **State Management**: TanStack Query (React Query)
- **Authentication**: Clerk with JWT tokens

### Backend

- **Database**: Supabase (PostgreSQL with RLS)
- **Queue System**: Upstash QStash
- **Cache & Locks**: Upstash Redis
- **Data Platform**: MotherDuck (DuckDB) + Fivetran
- **Runtime**: Vercel (Node.js 20.x)
- **AI**: Anthropic Claude

### Development

- **Monorepo**: Turborepo + pnpm workspaces
- **Language**: TypeScript 5.x (strict mode)
- **Linting**: ESLint with shared configurations
- **Formatting**: Prettier with Tailwind plugin
- **Testing**: Vitest + Testing Library
- **Commits**: Commitizen with gitmoji

## 📁 Project Structure

```text
hubble/
├── apps/
│   └── dashboard/              # Next.js 15 web application
│       ├── src/
│       │   ├── app/           # App Router pages and API routes
│       │   ├── middleware.ts  # Next.js middleware
│       │   └── providers/     # React context providers
│       └── package.json
│
├── mcp/
│   └── servers/                # MCP servers for AWS App Runner
│       ├── motherduck/        # MotherDuck MCP server
│       ├── Dockerfile         # Container configuration
│       └── Caddyfile          # Reverse proxy config
│
├── packages/                   # Shared TypeScript packages
│   ├── auth/                  # Authentication & organization utilities
│   ├── chat/                  # Chat logic & database operations
│   ├── config/                # Environment configuration
│   ├── connect/               # Connect provisioning system
│   ├── core/                  # Core utilities & error handling
│   ├── db/                    # Supabase client factories
│   ├── infrastructure/        # QStash & Redis services
│   ├── logger/                # Structured logging system
│   ├── schemas/               # Zod schemas & validation
│   ├── server/                # Server-only utilities
│   ├── types/                 # Shared TypeScript types
│   ├── ui/                    # React components & Tailwind preset
│   ├── eslint-config/         # Shared ESLint configuration
│   ├── prettier-config/       # Shared Prettier configuration
│   └── tsconfig/              # Shared TypeScript configuration
│
├── supabase/                  # Database migrations and schema
│   ├── migrations/            # Database migration files
│   ├── archive/               # Historical migration files
│   └── cleanup.sql            # Database cleanup scripts
│
├── docs/                      # Comprehensive documentation
│   ├── apps/                  # Application-specific docs
│   ├── packages/              # Package documentation
│   ├── mcp/                   # MCP server documentation
│   └── supabase/              # Database documentation
│
├── .github/workflows/         # CI/CD pipelines
├── package.json               # Root package configuration
├── pnpm-workspace.yaml        # pnpm workspace configuration
├── turbo.json                 # Turborepo configuration
└── tsconfig.json              # Root TypeScript configuration
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: 20.10+ (< 25)
- **pnpm**: 9.x+
- **Supabase**: Project with secure secrets table
- **Clerk**: Application with publishable/secret keys
- **Upstash**: QStash + Redis accounts
- **MotherDuck + Fivetran**: Credentials (for Connect feature)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/omzification/hubble.git
cd hubble
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

4. **Start development server**

```bash
pnpm dev
```

5. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔐 Environment Setup

### Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Upstash QStash (Queue System)
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your-token
QSTASH_CURRENT_SIGNING_KEY=your-key
QSTASH_NEXT_SIGNING_KEY=your-next-key

# Upstash Redis (Cache & Locks)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
UPSTASH_REDIS_WS_URL=wss://...upstash.io
UPSTASH_REDIS_WS_TOKEN=your-token

# Data Platform (Optional - for Connect feature)
MD_ADMIN_TOKEN=your-motherduck-token
FIVETRAN_API_KEY=your-fivetran-key
FIVETRAN_API_SECRET=your-fivetran-secret

# AI Service (Optional)
ANTHROPIC_API_KEY=your-anthropic-key
```

### Database Setup

1. **Create Supabase project** at [supabase.com](https://supabase.com)
2. **Run migrations**:

```bash
# Apply all migrations
supabase db push
```

3. **Set up RLS policies** for multi-tenant security
4. **Configure secrets table** for secure credential storage

## 📚 API Documentation

### Health & Status

- `GET /healthz` - Health check endpoint
- `GET /version` - Application version information

### Chat API

- `GET /api/v1/chat/conversations` - List user conversations
- `POST /api/v1/chat/conversations` - Create new conversation
- `PATCH /api/v1/chat/conversations/:id` - Update conversation
- `GET /api/v1/chat/messages/:conversationId` - List conversation messages
- `POST /api/v1/chat/messages/:conversationId` - Create new message
- `POST /api/v1/chat` - Send AI chat request

### Connect API

- `POST /api/connect/enable` - Start data pipeline provisioning
- `GET /api/connect/status` - Check provisioning status
- `GET /api/connect/stream` - Real-time provisioning updates (SSE)
- `GET /api/connect/overview` - Connection overview
- `GET /api/connect/connector-types` - Available connector types

For detailed API documentation, see [docs/api/](docs/api/).

## 💻 Development

### Available Scripts

```bash
# Development
pnpm dev                    # Start all applications
pnpm build                  # Build all packages
pnpm typecheck             # TypeScript type checking
pnpm lint                  # ESLint linting
pnpm test                  # Run test suite
pnpm format                # Format code with Prettier

# Package-specific commands
pnpm --filter @hubble/dashboard dev
pnpm --filter @hubble/ui build
pnpm --filter @hubble/auth typecheck

# MCP Development
pnpm mcp:dev:motherduck    # Start MotherDuck MCP server
pnpm mcp:inspector:motherduck  # Start MCP inspector
```

### Code Quality

The project enforces high code quality standards:

- **TypeScript**: Strict mode with comprehensive type checking
- **ESLint**: Shared configuration across all packages
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality checks
- **Commitizen**: Standardized commit messages

### Commit Convention

We use [gitmoji](https://gitmoji.dev/) for commit messages:

```bash
pnpm commit  # Interactive commit with gitmoji
```

Examples:

- `✨ feat: add workspace switcher`
- `🐛 fix: resolve auth token expiry`
- `📝 docs: update API documentation`
- `♻️ refactor: simplify error handling`
- `🧪 test: add unit tests for chat service`

## 🚀 Deployment

### Vercel Deployment

The application is configured for automatic deployment on Vercel:

- **Production**: Deploys from `main` branch
- **Preview**: Deploys from pull requests
- **Configuration**: `apps/dashboard/vercel.json`

### Environment Variables

Set the following environment variables in your Vercel project:

1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add all required variables from the [Environment Setup](#-environment-setup) section
3. Ensure variables are available for Production, Preview, and Development

### Database Migrations

Database migrations are automatically applied during deployment:

1. **Supabase**: Migrations run via GitHub Actions
2. **Schema Updates**: Applied through `supabase db push`
3. **Data Migrations**: Handled by migration scripts

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Start for Contributors

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Run quality checks**: `pnpm lint && pnpm typecheck && pnpm test`
5. **Commit your changes**: `pnpm commit`
6. **Push to your fork**: `git push origin feature/amazing-feature`
7. **Create a Pull Request**

### Development Guidelines

- Follow the existing code style and patterns
- Write tests for new features
- Update documentation for API changes
- Ensure all CI checks pass
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a Service
- [Clerk](https://clerk.com/) - Authentication
- [Upstash](https://upstash.com/) - Serverless Redis and QStash
- [MotherDuck](https://motherduck.com/) - Analytics database
- [Fivetran](https://fivetran.com/) - Data pipeline platform
- [Vercel](https://vercel.com/) - Deployment platform

---

Built with ❤️ by the Hubble team

[![GitHub](https://img.shields.io/badge/GitHub-omzification/hubble-blue?style=flat-square&logo=github)](https://github.com/omzification/hubble)
[![Website](https://img.shields.io/website?url=https://hubble.vercel.app&style=flat-square)](https://hubble.vercel.app)
