# Hubble Dashboard

A unified Next.js application that combines the web interface and API endpoints for Hubble - an AI-powered Marketing Assistant.

## Architecture

This is a full-stack Next.js 15 application that includes:

- Frontend UI with Clerk authentication
- API routes for chat functionality
- Supabase database integration
- Anthropic AI integration

## Environment Setup

### 1. Create Environment File

Create a `.env.local` file at the **project root** (not in the dashboard app directory):

````bash
# Create the environment file at the project root
touch .env.local
```bash

### 2. Configure Environment Variables

Add the following variables to your `.env.local` file:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_service_role_key_here

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-latest

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Development
NODE_ENV=development
```bash

### 3. Environment Variable Loading

The application is configured to automatically load environment variables from the project root `.env.local` file:

- **Development**: Uses `dotenv-cli` to load variables from `../../.env.local`
- **Next.js Config**: Automatically loads variables from the project root
- **Build/Production**: Uses Vercel environment variables

## Development

```bash
# Install dependencies
pnpm install

# Run development server (loads env from project root)
pnpm dev

# Build for production
pnpm build

# Run type checking
pnpm typecheck

# Run linting
pnpm lint
```bash

## API Endpoints

The application includes the following API routes:

- `POST /api/v1/chat` - Process chat messages with AI
- `GET /api/v1/chat/conversations` - List user conversations
- `POST /api/v1/chat/conversations` - Create new conversation
- `PATCH /api/v1/chat/conversations/[id]` - Update conversation
- `GET /api/v1/chat/messages/[conversationId]` - Get messages in conversation
- `POST /api/v1/chat/messages/[conversationId]` - Add message to conversation

## Deployment

Deploy to Vercel with:

```bash
vercel
```bash

Ensure all environment variables are configured in your Vercel project settings.

## Project Structure

```bash
apps/dashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Authentication pages
│   │   ├── (protected)/     # Protected pages
│   │   ├── api/             # API routes
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page
│   └── middleware.ts        # Auth middleware
├── public/                  # Static assets
├── package.json
└── vercel.json             # Vercel configuration
```bash

## Environment Variable Management

### Development

- Variables are loaded from `../../.env.local` (project root)
- Uses `dotenv-cli` for reliable loading
- Next.js config also loads variables for build-time access

### Production

- Variables are managed through Vercel dashboard
- No local `.env.local` file needed in production
- All sensitive keys should be stored in Vercel secrets

### Security Notes

- Never commit `.env.local` to version control
- Use different keys for development and production
- Rotate keys regularly for security
````
