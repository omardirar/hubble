# Setting Up Secrets for Hubble

This document explains how to set up the required secrets for the Hubble application to work properly.

## Required Secrets

### 1. Clerk Authentication Secrets

You need to set up these secrets in your GitHub repository:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key (safe to expose)
- `CLERK_SECRET_KEY` - Clerk secret key (sensitive)

### 2. How to Get Clerk Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your project
3. Go to "API Keys" section
4. Copy the "Publishable key" and "Secret key"

### 3. Setting Secrets in GitHub

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add these secrets:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = your publishable key
- `CLERK_SECRET_KEY` = your secret key

### 4. Automatic Secret Management

**Good news!** The Clerk secret key is now automatically set during deployment. You don't need to manually manage it.

**How it works:**

- When you deploy (via pull request or push to main), the deployment pipeline automatically sets the `CLERK_SECRET_KEY` secret
- The secret is pulled from your GitHub repository secrets and set in Cloudflare Workers
- This happens before the web app is deployed, ensuring it's always available

**Manual management (optional):**
If you need to manually update the secret, you can still use the "Manage Cloudflare Secrets" workflow:

1. Go to the "Actions" tab in your GitHub repository
2. Click on "Manage Cloudflare Secrets"
3. Click "Run workflow"
4. Select Environment: `preview` (or `production`)
5. Select Action: `update`
6. Click "Run workflow"

### 5. Setting Environment Variables

For non-secret environment variables:

1. Go to the "Actions" tab in your GitHub repository
2. Click on "Manage Cloudflare Environment Variables"
3. Click "Run workflow"
4. Select Environment: `preview` (or `production`)
5. Select Action: `update`
6. Click "Run workflow"

### 6. Alternative: Manual Setup

You can also set the environment variables manually using Wrangler:

```bash
# For preview environment
cd apps/web
wrangler secret put CLERK_SECRET_KEY --env preview
wrangler env put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --env preview

# For production environment
wrangler secret put CLERK_SECRET_KEY --env production
wrangler env put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --env production
```

## Verification

After setting up the secrets, you can verify they're working by:

1. Deploying your application
2. Checking the logs for any authentication errors
3. Testing the sign-in/sign-up flow

## Troubleshooting

If you see errors like "Missing secretKey", it means the `CLERK_SECRET_KEY` environment variable is not set properly. Make sure you've:

1. Set the secret in GitHub repository secrets
2. Run the "Manage Cloudflare Environment Variables" workflow
3. Redeployed your application

## Security Notes

- Never commit secret keys to your repository
- Use GitHub secrets for sensitive data
- The `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is safe to expose in client-side code
- The `CLERK_SECRET_KEY` should only be used server-side
