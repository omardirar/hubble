# Documentation Overview

Welcome to the comprehensive documentation for the Hubble platform. This documentation provides detailed information about all aspects of the system, from high-level architecture to specific implementation details.

## Documentation Structure

### 📋 Quick Start

- [**Setup Guide**](./setup.md) - Complete development environment setup
- [**Usage Guide**](./usage.md) - How to use the platform features
- [**Architecture Guide**](./architecture.md) - System design and architecture

### 🏗 System Architecture

- [**Architecture Overview**](./architecture.md) - High-level system design
- [**Server Architecture**](./packages/server-architecture.md) - Agent backend and API orchestration
- [**Database Overview**](./supabase/overview.md) - Database structure and policies

### 📦 Package Documentation

- [**Package Overview**](./packages/overview.md) - Shared packages documentation
- [**Core Package**](./packages/core.md) - Core utilities and error handling
- [**Authentication Package**](./packages/auth.md) - Auth and organization management
- [**Database Package**](./packages/db.md) - Database client factories
- [**UI Package**](./packages/ui.md) - React components and design system

### 🖥 Application Documentation

- [**Dashboard Overview**](./apps/dashboard/overview.md) - Next.js 15 web application
- [**Dashboard API**](./apps/dashboard/api.md) - App Router endpoints and contracts
- [**MCP Integration**](../services/agents/docs/MCP_INTEGRATION.md) - Model Context Protocol servers

### 🧪 Testing & Quality

- [**Testing Documentation**](./tests/README.md) - Testing procedures and best practices
- [**Module Documentation**](./modules/README.md) - Individual module documentation

## Getting Started

### For Developers

1. **Read the [Setup Guide](./setup.md)** to set up your development environment
2. **Review the [Architecture Guide](./architecture.md)** to understand the system design
3. **Explore the [Package Documentation](./packages/overview.md)** to understand shared components
4. **Check the [Dashboard API Reference](./apps/dashboard/api.md)** for API usage

### For Users

1. **Read the [Usage Guide](./usage.md)** to learn how to use the platform
2. **Explore the [Dashboard Documentation](./apps/dashboard/overview.md)** for UI features
3. **Check the [Dashboard API Reference](./apps/dashboard/api.md)** for programmatic access

### For Contributors

1. **Read the [Contributing Guide](../CONTRIBUTING.md)** for contribution guidelines
2. **Review the [Testing Documentation](./tests/README.md)** for testing procedures
3. **Explore the [Module Documentation](./modules/README.md)** for module development

## Documentation Standards

### Writing Guidelines

- **Clear and Concise**: Use simple, straightforward language
- **Consistent Formatting**: Follow established formatting patterns
- **Comprehensive Coverage**: Document all aspects of the system
- **Regular Updates**: Keep documentation current with code changes

### Code Examples

- **TypeScript**: All code examples use TypeScript
- **Error Handling**: Include proper error handling in examples
- **Best Practices**: Follow established coding patterns
- **Comments**: Include explanatory comments where helpful

### Visual Elements

- **Diagrams**: Use Mermaid diagrams for architecture and flow
- **Screenshots**: Include UI screenshots where appropriate
- **Code Blocks**: Use syntax highlighting for code examples
- **Tables**: Use tables for structured information

## Key Features Documented

### 🤖 AI-Powered Chat

- **Real-time Messaging**: Live conversation updates
- **Context Management**: Maintains conversation context
- **Tool Integration**: AI tools for data analysis
- **Multi-conversation Support**: Manage multiple chat sessions

### 🔌 Data Pipeline Management

- **Automated Provisioning**: One-click data source setup
- **MotherDuck Integration**: Per-tenant analytics databases
- **Fivetran Connectors**: Automated data pipeline configuration
- **Real-time Monitoring**: Live provisioning status updates

### 🏢 Multi-tenant Architecture

- **Organization Management**: Multi-tenant data isolation
- **User Management**: Team collaboration features
- **Role-based Access**: Granular permission system
- **Audit Logging**: Comprehensive activity tracking

### 🚀 Modern Technology Stack

- **Next.js 15**: Latest React framework with App Router
- **TypeScript**: Type-safe development
- **Supabase**: Backend-as-a-Service with PostgreSQL
- **Tailwind CSS**: Utility-first styling
- **Vercel**: Cloud deployment platform

## API Reference

### REST API

- **Base URL**: `https://hubble.vercel.app`
- **Authentication**: JWT tokens via Clerk
- **Rate Limiting**: Per-user rate limits
- **Error Handling**: Consistent error response format

### Available Endpoints

- **Chat API**: `/api/v1/chat/*` - Conversation and message management
- **Connect API**: `/api/connect/*` - Data pipeline provisioning
- **System API**: `/healthz`, `/version` - Health and version info

### SDK Support

- **JavaScript/TypeScript**: Full SDK with type definitions
- **Python**: Python SDK for server-side integration
- **cURL Examples**: Command-line usage examples

## Database Schema

### Core Tables

- **Organizations**: Multi-tenant organization management
- **Conversations**: AI chat conversation storage
- **Messages**: Individual chat messages
- **Connections**: Data source connections

### Security Features

- **Row Level Security (RLS)**: Organization-scoped data access
- **JWT Authentication**: Secure token-based authentication
- **Audit Logging**: Comprehensive activity tracking
- **Data Encryption**: Encryption at rest and in transit

## Development Workflow

### Local Development

1. **Clone Repository**: `git clone https://github.com/omzification/hubble.git`
2. **Install Dependencies**: `pnpm install`
3. **Set Environment Variables**: Copy `.env.example` to `.env.local`
4. **Start Development Server**: `pnpm dev`

### Code Quality

- **TypeScript**: Strict type checking
- **ESLint**: Code linting and formatting
- **Prettier**: Consistent code formatting
- **Testing**: Comprehensive test coverage

### Deployment

- **Vercel**: Automatic deployment from GitHub
- **Environment Variables**: Secure configuration management
- **Health Checks**: Automated health monitoring
- **Rollback**: Easy rollback capabilities

## Contributing

### How to Contribute

1. **Fork the Repository**: Create your own fork
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Make Changes**: Follow coding standards
4. **Write Tests**: Add tests for new functionality
5. **Update Documentation**: Keep docs current
6. **Submit Pull Request**: Create PR with clear description

### Contribution Guidelines

- **Code Standards**: Follow established patterns
- **Testing**: Maintain high test coverage
- **Documentation**: Update relevant documentation
- **Security**: Follow security best practices

## Support

### Getting Help

- **Documentation**: Check this documentation first
- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and discuss ideas
- **Email Support**: Contact [support@hubble.com](mailto:support@hubble.com)

### Community

- **Discord**: Join our community Discord server
- **Stack Overflow**: Tag questions with `hubble`
- **Twitter**: Follow @hubble for updates
- **Blog**: Read our technical blog posts

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## Changelog

### Recent Updates

- **v1.0.0**: Initial release with core features
- **Documentation**: Comprehensive documentation refresh
- **API**: Complete API documentation
- **Testing**: Comprehensive testing documentation

### Upcoming Features

- **Mobile App**: Native mobile applications
- **Advanced Analytics**: Enhanced reporting capabilities
- **Custom Integrations**: More third-party integrations
- **Enterprise Features**: Advanced enterprise capabilities

---

## Built with ❤️ by the Hubble team

For questions or support, please reach out through our [GitHub Discussions](https://github.com/omzification/hubble/discussions) or [contact us directly](mailto:support@hubble.com).
