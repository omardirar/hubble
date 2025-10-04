# Usage Guide

This guide provides comprehensive instructions for using the Hubble platform, including features, workflows, and best practices.

## Overview

Hubble is an AI-powered marketing assistant platform that provides intelligent chat capabilities, automated data pipeline management, and comprehensive analytics. This guide covers how to use all major features effectively.

## Getting Started

### First Time Setup

1. **Sign Up**: Create an account using the sign-up page
2. **Organization Setup**: Create or join an organization
3. **Profile Configuration**: Complete your user profile
4. **Feature Activation**: Enable desired features (Chat, Connect)

### Dashboard Overview

The main dashboard provides access to all platform features:

- **Navigation Sidebar**: Quick access to all features
- **Organization Switcher**: Switch between organizations
- **User Profile**: Account and settings management
- **Feature Cards**: Direct access to main features

## Chat Feature

### Starting a Conversation

1. **Navigate to Chat**: Click "Chat" in the sidebar
2. **Create New Conversation**: Click "New Conversation" button
3. **Enter Title**: Provide a descriptive title
4. **Start Chatting**: Type your message and press Enter

### Chat Interface

#### Message Types

- **User Messages**: Your questions and requests
- **AI Responses**: Intelligent responses from Claude
- **System Messages**: Platform notifications and updates
- **Tool Messages**: Results from data analysis tools

#### Chat Features

- **Real-time Updates**: Messages appear instantly
- **Message History**: Complete conversation history
- **Export Conversations**: Download chat history
- **Archive Conversations**: Organize old conversations

### Advanced Chat Features

#### Context Management

```typescript
// The AI maintains context across messages
// You can reference previous parts of the conversation
// Example: "Can you elaborate on the marketing strategy you mentioned earlier?"
```

#### Tool Integration

- **Data Analysis**: Query your analytics data
- **Report Generation**: Create marketing reports
- **Trend Analysis**: Identify patterns in your data
- **Recommendations**: Get AI-powered suggestions

#### Conversation Management

- **Title Generation**: Auto-generate conversation titles
- **Conversation Search**: Find specific conversations
- **Conversation Sharing**: Share conversations with team members
- **Conversation Archiving**: Organize conversation history

### Chat Best Practices

#### Effective Prompting

- **Be Specific**: Provide clear, detailed questions
- **Provide Context**: Include relevant background information
- **Use Examples**: Give examples of what you're looking for
- **Iterate**: Refine your questions based on responses

#### Example Prompts

```text
Good: "Analyze our Q4 marketing performance and identify the top 3 campaigns by ROI, including budget allocation and conversion rates."

Better: "Analyze our Q4 2024 marketing performance for the e-commerce division. Focus on Facebook Ads and Google Ads campaigns with budgets over $10k. Identify the top 3 campaigns by ROI and provide specific recommendations for Q1 2025."
```

## Connect Feature

### Data Pipeline Setup

#### 1. Enable Connect

1. **Navigate to Connect**: Click "Connect" in the sidebar
2. **Start Provisioning**: Click "Enable Connect" button
3. **Select Connectors**: Choose data sources to connect
4. **Monitor Progress**: Watch real-time provisioning status

#### 2. Available Connectors

- **Facebook Ads**: Connect Facebook advertising data
- **Google Ads**: Connect Google advertising data
- **TikTok Ads**: Connect TikTok advertising data
- **LinkedIn Ads**: Connect LinkedIn advertising data

#### 3. Provisioning Process

The provisioning process includes:

- **MotherDuck Database Creation**: Per-organization analytics database
- **Fivetran Destination Setup**: Data pipeline configuration
- **Connector Authentication**: Secure credential storage
- **Initial Data Sync**: First data synchronization

### Data Management

#### Data Destinations

- **MotherDuck Database**: Your organization's analytics database
- **Database Name**: `md_org_{org_id}`
- **Access Control**: Organization-scoped data access
- **Data Retention**: Configurable retention policies

#### Data Connections

- **Connection Status**: Real-time connection health
- **Sync Frequency**: Configurable sync intervals
- **Data Quality**: Automated data validation
- **Error Handling**: Comprehensive error reporting

### Data Analysis

#### Querying Data

```sql
-- Example: Get campaign performance
SELECT
  campaign_name,
  spend,
  impressions,
  clicks,
  conversions,
  (conversions / spend) as roi
FROM facebook_ads_campaigns
WHERE date >= '2024-01-01'
ORDER BY roi DESC
LIMIT 10;
```

#### Available Data Tables

- **Campaign Data**: Campaign performance metrics
- **Ad Data**: Individual ad performance
- **Audience Data**: Audience demographics and behavior
- **Conversion Data**: Conversion tracking and attribution

#### Data Visualization

- **Interactive Charts**: Built-in charting capabilities
- **Custom Dashboards**: Create personalized dashboards
- **Report Templates**: Pre-built report templates
- **Export Options**: Export data in various formats

## Organization Management

### User Management

#### Adding Team Members

1. **Navigate to Team**: Click "Team" in the sidebar
2. **Invite Users**: Click "Invite User" button
3. **Enter Email**: Provide user's email address
4. **Assign Role**: Choose appropriate role
5. **Send Invitation**: Send invitation email

#### User Roles

- **Owner**: Full platform access and billing management
- **Admin**: Full feature access except billing
- **Member**: Standard feature access
- **Viewer**: Read-only access

#### Role Permissions

```typescript
interface RolePermissions {
    owner: {
        billing: true
        userManagement: true
        dataAccess: "full"
        featureAccess: "all"
    }
    admin: {
        billing: false
        userManagement: true
        dataAccess: "full"
        featureAccess: "all"
    }
    member: {
        billing: false
        userManagement: false
        dataAccess: "organization"
        featureAccess: "standard"
    }
    viewer: {
        billing: false
        userManagement: false
        dataAccess: "read-only"
        featureAccess: "read-only"
    }
}
```

### Workspace Settings

#### Organization Configuration

- **Organization Name**: Display name for your organization
- **Organization Slug**: URL-friendly identifier
- **Organization Logo**: Custom branding
- **Default Settings**: Organization-wide defaults

#### Feature Configuration

- **Chat Settings**: AI model preferences, system prompts
- **Connect Settings**: Data source preferences, sync schedules
- **Notification Settings**: Email and in-app notifications
- **Security Settings**: Authentication and access controls

## Analytics & Reporting

### Dashboard Analytics

#### Key Metrics

- **Conversation Volume**: Number of conversations per period
- **Message Count**: Total messages across all conversations
- **User Engagement**: Active users and session duration
- **Feature Usage**: Most used features and tools

#### Performance Metrics

- **Response Time**: AI response latency
- **Data Sync Status**: Connection health and sync frequency
- **Error Rates**: System error tracking
- **Uptime**: Platform availability

### Custom Reports

#### Report Builder

1. **Navigate to Reports**: Click "Reports" in the sidebar
2. **Create New Report**: Click "New Report" button
3. **Select Data Source**: Choose data tables
4. **Configure Metrics**: Select metrics and dimensions
5. **Apply Filters**: Add date ranges and filters
6. **Generate Report**: Create and save report

#### Report Types

- **Marketing Performance**: Campaign and ad performance
- **User Engagement**: User activity and feature usage
- **Data Quality**: Data accuracy and completeness
- **System Health**: Platform performance and reliability

#### Scheduled Reports

- **Daily Reports**: Automated daily summaries
- **Weekly Reports**: Weekly performance overviews
- **Monthly Reports**: Monthly business reviews
- **Custom Schedules**: Flexible scheduling options

## API Usage

### Authentication

#### API Keys

```typescript
// Get API key from user settings
const apiKey = await getUserApiKey()

// Use in API requests
const response = await fetch("/api/v1/chat/conversations", {
    headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
    },
})
```

#### JWT Tokens

```typescript
// For server-side applications
const token = await getJWTToken()
const response = await fetch("/api/v1/chat/conversations", {
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    },
})
```

### API Examples

#### Chat API

```typescript
// Create conversation
const conversation = await fetch("/api/v1/chat/conversations", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        title: "Marketing Strategy Discussion",
        model: "claude-3-sonnet",
    }),
})

// Send message
const message = await fetch("/api/v1/chat", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        conversation_id: conversation.id,
        message: "Analyze our Q4 marketing performance",
        model: "claude-3-sonnet",
    }),
})
```

#### Connect API

```typescript
// Start provisioning
const provision = await fetch("/api/connect/enable", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        connector_types: ["facebook_ads", "google_ads"],
    }),
})

// Check status
const status = await fetch(`/api/connect/status?correlation_id=${provision.correlation_id}`, {
    headers: {
        Authorization: `Bearer ${token}`,
    },
})
```

## Integration Examples

### Webhook Integration

#### Setting Up Webhooks

1. **Navigate to Settings**: Go to organization settings
2. **Webhook Configuration**: Click "Webhooks" tab
3. **Add Webhook**: Click "Add Webhook" button
4. **Configure URL**: Enter your webhook endpoint
5. **Select Events**: Choose events to subscribe to
6. **Test Webhook**: Send test webhook

#### Webhook Events

```typescript
interface WebhookEvent {
    event:
        | "conversation.created"
        | "conversation.updated"
        | "message.created"
        | "provision.completed"
    data: {
        id: string
        org_id: string
        timestamp: string
        // Event-specific data
    }
}
```

#### Webhook Handler Example

```typescript
// Express.js webhook handler
app.post("/webhook", (req, res) => {
    const { event, data } = req.body

    switch (event) {
        case "conversation.created":
            handleConversationCreated(data)
            break
        case "message.created":
            handleMessageCreated(data)
            break
        case "provision.completed":
            handleProvisionCompleted(data)
            break
    }

    res.status(200).json({ received: true })
})
```

### SDK Integration

#### JavaScript SDK

```typescript
import { HubbleClient } from "@hubble/sdk"

const client = new HubbleClient({
    apiKey: "your-api-key",
    baseUrl: "https://hubble.vercel.app",
})

// Chat operations
const conversations = await client.chat.conversations.list()
const conversation = await client.chat.conversations.create({
    title: "New Conversation",
})

// Connect operations
const status = await client.connect.status("prov_123")
const overview = await client.connect.overview()
```

#### Python SDK

```python
from hubble import HubbleClient

client = HubbleClient(
  api_key='your-api-key',
  base_url='https://hubble.vercel.app'
)

# Chat operations
conversations = client.chat.conversations.list()
conversation = client.chat.conversations.create(
  title='New Conversation'
)

# Connect operations
status = client.connect.status('prov_123')
overview = client.connect.overview()
```

## Best Practices

### Security Best Practices

#### API Security

- **Use HTTPS**: Always use secure connections
- **Rotate Keys**: Regularly rotate API keys
- **Limit Permissions**: Use minimal required permissions
- **Monitor Usage**: Track API usage and anomalies

#### Data Security

- **Encrypt Sensitive Data**: Use encryption for sensitive information
- **Access Controls**: Implement proper access controls
- **Audit Logging**: Maintain comprehensive audit logs
- **Regular Backups**: Backup data regularly

### Performance Best Practices

#### Chat Performance

- **Optimize Prompts**: Use clear, concise prompts
- **Batch Requests**: Combine multiple requests when possible
- **Cache Responses**: Cache frequently accessed data
- **Monitor Latency**: Track response times

#### Data Performance

- **Efficient Queries**: Write optimized database queries
- **Index Usage**: Use appropriate database indexes
- **Data Pagination**: Implement pagination for large datasets
- **Connection Pooling**: Use connection pooling for databases

### Usage Optimization

#### Chat Optimization

- **Context Management**: Maintain relevant context
- **Prompt Engineering**: Use effective prompting techniques
- **Tool Selection**: Choose appropriate tools for tasks
- **Iterative Improvement**: Continuously improve prompts

#### Data Optimization

- **Data Quality**: Ensure data accuracy and completeness
- **Sync Scheduling**: Optimize data sync schedules
- **Storage Management**: Manage data storage efficiently
- **Query Optimization**: Optimize data queries

## Troubleshooting

### Common Issues

#### Chat Issues

- **Slow Responses**: Check network connection and server status
- **Context Loss**: Ensure conversation context is maintained
- **Tool Errors**: Verify tool configurations and permissions
- **Rate Limiting**: Check API rate limits and usage

#### Connect Issues

- **Sync Failures**: Check data source connectivity
- **Authentication Errors**: Verify credentials and permissions
- **Data Quality Issues**: Review data validation rules
- **Performance Issues**: Optimize sync schedules and queries

#### General Issues

- **Login Problems**: Check authentication configuration
- **Permission Errors**: Verify user roles and permissions
- **API Errors**: Review API documentation and error codes
- **Performance Issues**: Monitor system resources and usage

### Getting Help

#### Documentation

- **User Guide**: This comprehensive usage guide
- **API Documentation**: Detailed API reference
- **FAQ**: Frequently asked questions
- **Video Tutorials**: Step-by-step video guides

#### Support Channels

- **In-App Support**: Use the support feature in the dashboard
- **Email Support**: Contact [support@hubble.com](mailto:support@hubble.com)
- **Community Forum**: Join discussions and ask questions
- **GitHub Issues**: Report bugs and request features

#### Debug Information

- **Browser Console**: Check browser developer tools
- **Network Tab**: Monitor API requests and responses
- **Error Logs**: Review application error logs
- **System Status**: Check platform status page

## Advanced Features

### Custom Integrations

#### Custom Connectors

- **Data Source Integration**: Connect custom data sources
- **API Integration**: Integrate with custom APIs
- **Webhook Integration**: Set up custom webhooks
- **Event Processing**: Process custom events

#### Custom Tools

- **AI Tools**: Create custom AI-powered tools
- **Data Tools**: Build custom data analysis tools
- **Automation Tools**: Develop custom automation
- **Reporting Tools**: Create custom reporting tools

### Enterprise Features

#### Advanced Security

- **SSO Integration**: Single sign-on integration
- **RBAC**: Role-based access control
- **Audit Logging**: Comprehensive audit trails
- **Compliance**: SOC 2, GDPR compliance

#### Advanced Analytics

- **Custom Dashboards**: Build custom analytics dashboards
- **Advanced Reporting**: Create complex reports
- **Data Export**: Export data in various formats
- **API Access**: Full API access for custom integrations

## Related Documentation

- [Setup Guide](./setup.md)
- [Architecture Guide](./architecture.md)
- [API Documentation](./api/README.md)
- [Package Documentation](./packages/README.md)
- [Database Schema](./supabase/README.md)
