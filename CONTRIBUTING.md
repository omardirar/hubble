# Contributing to Hubble

Thank you for your interest in contributing to Hubble! This guide will help you get started with contributing to our AI-powered marketing assistant platform.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Community Guidelines](#community-guidelines)
- [Release Process](#release-process)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. By participating in this project, you agree to:

- **Be respectful** and inclusive in all interactions
- **Be constructive** in feedback and discussions
- **Be patient** with newcomers and learning processes
- **Be collaborative** and work together toward common goals
- **Be professional** in all communications

### Unacceptable Behavior

The following behaviors are considered unacceptable:

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Spam or off-topic discussions
- Sharing private information without permission
- Any other unprofessional conduct

### Enforcement

Violations of this code of conduct may result in:

- Warning and education
- Temporary or permanent ban from the project
- Reporting to appropriate authorities if necessary

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 20.10+** (< 25)
- **pnpm 9.x+** package manager
- **Git** for version control
- **Docker** (optional, for containerized development)
- **Supabase CLI** (for database operations)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

```bash
git clone https://github.com/your-username/hubble.git
cd hubble
```

3. **Add upstream remote**:

```bash
git remote add upstream https://github.com/omzification/hubble.git
```

### Development Setup

1. **Install dependencies**:

```bash
pnpm install
```

2. **Set up environment variables**:

```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

3. **Start development server**:

```bash
pnpm dev
```

4. **Verify setup**:

- Open [http://localhost:3000](http://localhost:3000)
- Ensure all tests pass: `pnpm test`
- Check linting: `pnpm lint`

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- **Bug Fixes**: Fix existing issues
- **Features**: Add new functionality
- **Documentation**: Improve documentation
- **Tests**: Add or improve test coverage
- **Performance**: Optimize existing code
- **Security**: Address security vulnerabilities
- **Refactoring**: Improve code quality

### Contribution Process

1. **Check existing issues** and pull requests
2. **Create an issue** for significant changes
3. **Fork and branch** from `main`
4. **Make your changes** following our standards
5. **Test thoroughly** with comprehensive tests
6. **Submit a pull request** with clear description
7. **Respond to feedback** and make requested changes

### Branch Naming

Use descriptive branch names:

```bash
# Feature branches
feature/add-user-dashboard
feature/implement-chat-history

# Bug fix branches
fix/resolve-auth-token-expiry
fix/fix-database-connection-issue

# Documentation branches
docs/update-api-documentation
docs/add-contributing-guide

# Refactoring branches
refactor/simplify-error-handling
refactor/optimize-database-queries
```

## Code Standards

### TypeScript Standards

- **Strict Mode**: Always use TypeScript strict mode
- **Type Safety**: Avoid `any` types, use proper typing
- **Interfaces**: Use interfaces for object shapes
- **Enums**: Use enums for fixed sets of values
- **Generics**: Use generics for reusable code

```typescript
// Good
interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

// Avoid
const user: any = { ... }
```

### React Standards

- **Functional Components**: Use functional components with hooks
- **TypeScript Props**: Always type component props
- **Custom Hooks**: Extract reusable logic into custom hooks
- **Error Boundaries**: Use error boundaries for error handling

```typescript
// Good
interface ButtonProps {
  variant: 'primary' | 'secondary'
  onClick: () => void
  children: React.ReactNode
}

export function Button({ variant, onClick, children }: ButtonProps) {
  return (
  <button className={cn('btn', variant)} onClick={onClick}>
    {children}
  </button>
  )
}
```

### Database Standards

- **RLS Policies**: Always use Row Level Security
- **Parameterized Queries**: Use parameterized queries to prevent SQL injection
- **Transactions**: Use transactions for complex operations
- **Indexes**: Add appropriate indexes for performance

```typescript
// Good
const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })

// Avoid
const { data } = await supabase.from("conversations").select("*").eq("org_id", `'${orgId}'`) // SQL injection risk
```

### Error Handling

- **Custom Error Classes**: Use specific error types
- **Error Boundaries**: Implement error boundaries in React
- **Logging**: Use structured logging for debugging
- **User-Friendly Messages**: Provide clear error messages

```typescript
// Good
import { DatabaseError, ValidationError } from "@hubble/core"

try {
    const result = await databaseOperation()
    return result
} catch (error) {
    if (error instanceof ValidationError) {
        throw error
    }

    throw new DatabaseError("Database operation failed", {
        operation: "create",
        originalError: error,
    })
}
```

### Performance Standards

- **Bundle Size**: Monitor and optimize bundle size
- **Lazy Loading**: Use lazy loading for large components
- **Memoization**: Use React.memo and useMemo appropriately
- **Database Queries**: Optimize database queries

```typescript
// Good
const ExpensiveComponent = React.memo(({ data }: { data: Data[] }) => {
  const processedData = useMemo(() => {
  return data.map(item => processItem(item))
  }, [data])

  return <div>{/* render */}</div>
})
```

## Testing

### Test Structure

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **API Tests**: Test API endpoints

### Writing Tests

```typescript
// Unit test example
import { describe, it, expect, vi } from "vitest"
import { generateId } from "@hubble/core"

describe("generateId", () => {
    it("should generate unique IDs", () => {
        const id1 = generateId()
        const id2 = generateId()
        expect(id1).not.toBe(id2)
    })

    it("should include prefix when provided", () => {
        const id = generateId("user")
        expect(id).toMatch(/^user_/)
    })
})
```

### Test Coverage

- **Minimum Coverage**: 80% code coverage
- **Critical Paths**: 100% coverage for critical functionality
- **Edge Cases**: Test edge cases and error conditions
- **Integration**: Test component integration

### Running Tests

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

## Pull Request Process

### Before Submitting

1. **Run quality checks**:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

2. **Update documentation** if needed
3. **Add tests** for new functionality
4. **Update changelog** if applicable

### Pull Request Template

Use this template for pull requests:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project standards
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass
- [ ] No breaking changes (or documented)

## Screenshots (if applicable)

Add screenshots for UI changes

## Related Issues

Closes #123
```

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one maintainer review required
3. **Testing**: Manual testing may be required
4. **Documentation**: Documentation updates reviewed
5. **Approval**: Maintainer approval required for merge

### After Approval

1. **Squash and Merge**: Use squash and merge for clean history
2. **Delete Branch**: Delete feature branch after merge
3. **Update Issues**: Close related issues
4. **Celebrate**: Your contribution is now part of Hubble! 🎉

## Issue Reporting

### Bug Reports

When reporting bugs, include:

- **Clear Description**: What happened vs. what you expected
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Environment**: OS, browser, Node.js version, etc.
- **Screenshots**: Visual evidence if applicable
- **Logs**: Relevant error logs or console output

### Feature Requests

When requesting features, include:

- **Use Case**: Why is this feature needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: What alternatives have you considered?
- **Additional Context**: Any other relevant information

### Issue Labels

We use labels to categorize issues:

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention needed
- `priority: high`: High priority issue
- `priority: low`: Low priority issue

## Community Guidelines

### Communication

- **Be Respectful**: Treat everyone with respect
- **Be Constructive**: Provide helpful feedback
- **Be Patient**: Allow time for responses
- **Be Clear**: Use clear and concise language

### Support Resources

- **Documentation**: Check existing documentation first
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Community**: Join our community channels

### Recognition

We recognize contributors through:

- **Contributor List**: Listed in project README
- **Release Notes**: Mentioned in release notes
- **Badges**: GitHub contributor badges
- **Community**: Recognition in community channels

## Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features (backward compatible)
- **Patch** (0.0.1): Bug fixes (backward compatible)

### Release Schedule

- **Patch Releases**: As needed for bug fixes
- **Minor Releases**: Monthly for new features
- **Major Releases**: Quarterly for breaking changes

### Release Steps

1. **Feature Freeze**: Stop adding new features
2. **Testing**: Comprehensive testing phase
3. **Documentation**: Update documentation
4. **Release Notes**: Prepare release notes
5. **Deployment**: Deploy to production
6. **Announcement**: Announce release to community

## Development Tools

### Recommended VS Code Extensions

- **TypeScript**: TypeScript support
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Tailwind CSS**: Tailwind CSS support
- **GitLens**: Git integration
- **Thunder Client**: API testing

### VS Code Settings

```json
{
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    },
    "typescript.preferences.importModuleSpecifier": "relative"
}
```

### Git Hooks

We use Husky for git hooks:

- **Pre-commit**: Run linting and formatting
- **Pre-push**: Run tests before pushing
- **Commit-msg**: Validate commit messages

## Troubleshooting

### Common Issues

1. **Build Failures**

- Check TypeScript errors: `pnpm typecheck`
- Verify dependencies: `pnpm install`
- Clear cache: `pnpm turbo clean`

2. **Test Failures**

- Check test environment setup
- Verify test data and mocks
- Run tests individually to isolate issues

3. **Linting Errors**

- Fix auto-fixable issues: `pnpm lint --fix`
- Check ESLint configuration
- Verify code formatting

4. **Database Issues**

- Check Supabase connection
- Verify RLS policies
- Check migration status

### Getting Help

If you encounter issues:

1. **Check Documentation**: Review relevant documentation
2. **Search Issues**: Look for similar issues
3. **Ask Questions**: Use GitHub Discussions
4. **Create Issue**: If no solution found

## License

By contributing to Hubble, you agree that your contributions will be licensed under the MIT License.

## Thank You

Thank you for contributing to Hubble! Your contributions help make this project better for everyone. We appreciate your time and effort in making Hubble a great platform for AI-powered marketing assistance.

---

**Happy Contributing!** 🚀

For questions or support, please reach out to us through GitHub Discussions or create an issue.
