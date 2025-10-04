# Packages Documentation

This directory contains comprehensive documentation for all shared TypeScript packages in the Hubble monorepo.

## Overview

The Hubble platform is built using a monorepo architecture with shared packages that provide common functionality across applications. Each package is independently versioned and can be used by multiple applications.

## Package Categories

### Core Packages

- [**@hubble/core**](./core/README.md) - Core utilities, error handling, and common functions
- [**@hubble/types**](./types/README.md) - Shared TypeScript types and interfaces
- [**@hubble/schemas**](./schemas/README.md) - Zod schemas for validation

### Authentication & Authorization

- [**@hubble/auth**](./auth/README.md) - Authentication and organization management

### Data & Database

- [**@hubble/db**](./db/README.md) - Supabase client factories and database utilities
- [**@hubble/chat**](./chat/README.md) - Chat functionality and database operations
- [**@hubble/connect**](./connect/README.md) - Data pipeline provisioning system

### Infrastructure

- [**@hubble/infrastructure**](./infrastructure/README.md) - QStash and Redis services
- [**@hubble/server**](./server/README.md) - Server-only utilities and API helpers

### UI & Components

- [**@hubble/ui**](./ui/README.md) - React components and Tailwind preset

### Configuration & Tools

- [**@hubble/config**](./config/README.md) - Environment configuration and validation
- [**@hubble/logger**](./logger/README.md) - Structured logging system
- [**@hubble/eslint-config**](./eslint-config/README.md) - Shared ESLint configuration
- [**@hubble/prettier-config**](./prettier-config/README.md) - Shared Prettier configuration
- [**@hubble/tsconfig**](./tsconfig/README.md) - Shared TypeScript configuration

## Package Development

### Creating a New Package

1. **Create package directory**

```bash
mkdir packages/new-package
cd packages/new-package
```

2. **Initialize package.json**

```bash
pnpm init
```

3. **Set up TypeScript configuration**

```bash
cp ../tsconfig/tsconfig.json tsconfig.json
```

4. **Add to workspace**
   Update `pnpm-workspace.yaml` to include the new package

5. **Create source structure**

```text
src/
├── index.ts          # Main export file
├── types/           # TypeScript types
├── utils/           # Utility functions
└── README.md        # Package documentation
```

### Package Guidelines

#### Naming Convention

- Use `@hubble/` prefix for all packages
- Use kebab-case for package names
- Be descriptive and concise

#### Dependencies

- **Peer Dependencies**: Use for React, Next.js, and other major frameworks
- **Dependencies**: Only include packages that are actually used
- **Dev Dependencies**: Development tools and build dependencies

#### Exports

- **Main Export**: Always export from `src/index.ts`
- **Named Exports**: Prefer named exports over default exports
- **Type Exports**: Export TypeScript types alongside functions

#### Documentation

- **README.md**: Comprehensive package documentation
- **API Documentation**: Document all public APIs
- **Examples**: Include usage examples
- **Changelog**: Track version changes

### Package Scripts

Each package should include these standard scripts:

```json
{
    "scripts": {
        "build": "tsc",
        "dev": "tsc --watch",
        "typecheck": "tsc --noEmit",
        "lint": "eslint . --max-warnings=0",
        "test": "vitest",
        "clean": "rm -rf dist"
    }
}
```

### Testing

All packages should include comprehensive tests:

```typescript
// Example test structure
describe("PackageName", () => {
    describe("functionName", () => {
        it("should work correctly", () => {
            // Test implementation
        })
    })
})
```

### Versioning

Use semantic versioning (semver) for all packages:

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features (backward compatible)
- **Patch** (0.0.1): Bug fixes (backward compatible)

### Publishing

Packages are published to npm with the `@hubble/` scope:

```bash
# Build package
pnpm --filter @hubble/package-name build

# Publish package
pnpm --filter @hubble/package-name publish
```

## Package Dependencies

### Internal Dependencies

Packages can depend on other internal packages:

```typescript
// In package.json
{
  "dependencies": {
  "@hubble/core": "workspace:*",
  "@hubble/types": "workspace:*"
  }
}
```

### External Dependencies

Use external dependencies sparingly and prefer well-maintained packages:

```typescript
// In package.json
{
  "dependencies": {
  "zod": "^3.22.0",
  "react": "^18.0.0"
  }
}
```

## Development Workflow

### Local Development

1. **Install dependencies**

```bash
pnpm install
```

2. **Start development mode**

```bash
pnpm dev
```

3. **Run tests**

```bash
pnpm test
```

4. **Build packages**

```bash
pnpm build
```

### Adding Dependencies

1. **Add to specific package**

```bash
pnpm --filter @hubble/package-name add dependency-name
```

2. **Add to root (for dev tools)**

```bash
pnpm add -D dependency-name
```

### Updating Dependencies

1. **Update specific package**

```bash
pnpm --filter @hubble/package-name update dependency-name
```

2. **Update all packages**

```bash
pnpm update
```

## Package Architecture

### Layered Architecture

```text
┌─────────────────────────────────────┐
│           Applications              │
│        (apps/dashboard)             │
└─────────────────────────────────────┘
                  │
┌─────────────────────────────────────┐
│         Feature Packages            │
│    (@hubble/chat, @hubble/connect)  │
└─────────────────────────────────────┘
                  │
┌─────────────────────────────────────┐
│         Core Packages               │
│    (@hubble/core, @hubble/types)    │
└─────────────────────────────────────┘
                  │
┌─────────────────────────────────────┐
│       Infrastructure Packages       │
│  (@hubble/db, @hubble/infrastructure)│
└─────────────────────────────────────┘
```

### Package Responsibilities

- **Core Packages**: Fundamental utilities and types
- **Feature Packages**: Business logic and domain-specific functionality
- **Infrastructure Packages**: External service integrations
- **UI Packages**: Reusable components and styling
- **Config Packages**: Shared configurations and tools

## Best Practices

### Code Organization

1. **Single Responsibility**: Each package should have a clear, single purpose
2. **Minimal Dependencies**: Keep dependencies to a minimum
3. **Clear APIs**: Design clean, intuitive APIs
4. **Consistent Patterns**: Follow established patterns across packages

### Error Handling

1. **Custom Error Classes**: Use specific error types for different scenarios
2. **Error Boundaries**: Implement proper error boundaries in React components
3. **Logging**: Use structured logging for debugging and monitoring

### Performance

1. **Tree Shaking**: Design packages to support tree shaking
2. **Lazy Loading**: Implement lazy loading where appropriate
3. **Bundle Size**: Monitor and optimize bundle sizes

### Security

1. **Input Validation**: Validate all inputs using Zod schemas
2. **Authentication**: Implement proper authentication checks
3. **Authorization**: Use role-based access control where needed

## Troubleshooting

### Common Issues

1. **Build Failures**

- Check TypeScript errors: `pnpm typecheck`
- Verify dependencies: `pnpm install`
- Clear build cache: `pnpm clean`

2. **Import Errors**

- Check package exports in `package.json`
- Verify TypeScript configuration
- Ensure packages are built: `pnpm build`

3. **Dependency Issues**

- Check peer dependency warnings
- Verify version compatibility
- Update lockfile: `pnpm install --frozen-lockfile`

### Debug Mode

Enable debug logging by setting:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

## Contributing

When contributing to packages:

1. **Follow Package Guidelines**: Adhere to established patterns
2. **Write Tests**: Add comprehensive tests for new functionality
3. **Update Documentation**: Keep package documentation current
4. **Version Changes**: Update package version appropriately
5. **Update Dependencies**: Keep dependencies up to date

## Related Documentation

- [Root README](../../README.md)
- [Dashboard Documentation](../apps/dashboard/README.md)
- [API Documentation](../api/README.md)
- [Database Schema](../supabase/README.md)
