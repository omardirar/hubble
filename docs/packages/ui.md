# @hubble/ui

Comprehensive UI component library built with Radix UI and Tailwind CSS for the Hubble platform.

## Overview

The `@hubble/ui` package provides a complete set of reusable UI components built on top of Radix UI primitives and styled with Tailwind CSS. It includes components for forms, navigation, data display, feedback, and layout with full TypeScript support and accessibility features.

## Installation

```bash
pnpm add @hubble/ui
```

## Exports

### Layout Components

#### `Container`

Responsive container component with max-width constraints.

```typescript
import { Container } from '@hubble/ui'

function Layout() {
  return (
  <Container className="py-8">
    <h1>Page Content</h1>
  </Container>
  )
}
```

#### `Grid`

CSS Grid layout component with responsive breakpoints.

```typescript
import { Grid } from '@hubble/ui'

function Dashboard() {
  return (
  <Grid cols={3} gap={4} className="p-4">
    <div>Item 1</div>
    <div>Item 2</div>
    <div>Item 3</div>
  </Grid>
  )
}
```

#### `Flex`

Flexbox layout component with common flex utilities.

```typescript
import { Flex } from '@hubble/ui'

function Header() {
  return (
  <Flex justify="between" align="center" className="p-4">
    <h1>Logo</h1>
    <nav>Navigation</nav>
  </Flex>
  )
}
```

### Form Components

#### `Button`

Button component with multiple variants and sizes.

```typescript
import { Button } from '@hubble/ui'

function Actions() {
  return (
  <div className="space-x-2">
    <Button variant="primary" size="md">
      Primary Button
    </Button>
    <Button variant="secondary" size="sm">
      Secondary Button
    </Button>
    <Button variant="destructive" size="lg">
      Delete
    </Button>
  </div>
  )
}
```

#### `Input`

Input component with validation states and icons.

```typescript
import { Input } from '@hubble/ui'

function Form() {
  return (
  <div className="space-y-4">
    <Input
      label="Email"
      type="email"
      placeholder="Enter your email"
      required
    />
    <Input
      label="Password"
      type="password"
      placeholder="Enter your password"
      error="Password is required"
    />
  </div>
  )
}
```

#### `Textarea`

Textarea component with auto-resize and validation.

```typescript
import { Textarea } from '@hubble/ui'

function MessageForm() {
  return (
  <Textarea
    label="Message"
    placeholder="Type your message here..."
    rows={4}
    maxLength={1000}
    showCount
  />
  )
}
```

#### `Select`

Select component with search and multi-select support.

```typescript
import { Select } from '@hubble/ui'

function CategorySelect() {
  return (
  <Select
    label="Category"
    placeholder="Select a category"
    options={[
      { value: 'tech', label: 'Technology' },
      { value: 'business', label: 'Business' },
      { value: 'design', label: 'Design' }
    ]}
  />
  )
}
```

#### `Checkbox`

Checkbox component with indeterminate state support.

```typescript
import { Checkbox } from '@hubble/ui'

function Preferences() {
  return (
  <div className="space-y-2">
    <Checkbox
      label="Email notifications"
      description="Receive email updates"
      defaultChecked
    />
    <Checkbox
      label="SMS notifications"
      description="Receive SMS updates"
    />
  </div>
  )
}
```

#### `RadioGroup`

Radio group component with validation and accessibility.

```typescript
import { RadioGroup } from '@hubble/ui'

function PlanSelection() {
  return (
  <RadioGroup
    label="Choose a plan"
    options={[
      { value: 'basic', label: 'Basic', description: 'Free plan' },
      { value: 'pro', label: 'Pro', description: '$9/month' },
      { value: 'enterprise', label: 'Enterprise', description: 'Contact sales' }
    ]}
    defaultValue="basic"
  />
  )
}
```

### Data Display Components

#### `Table`

Table component with sorting, filtering, and pagination.

```typescript
import { Table } from '@hubble/ui'

function DataTable() {
  const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'status', label: 'Status', sortable: false }
  ]

  const data = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' }
  ]

  return (
  <Table
    columns={columns}
    data={data}
    sortable
    pagination
    pageSize={10}
  />
  )
}
```

#### `Card`

Card component with header, content, and footer sections.

```typescript
import { Card } from '@hubble/ui'

function UserCard() {
  return (
  <Card className="w-80">
    <Card.Header>
      <Card.Title>User Profile</Card.Title>
      <Card.Description>Manage your account settings</Card.Description>
    </Card.Header>
    <Card.Content>
      <p>User information goes here</p>
    </Card.Content>
    <Card.Footer>
      <Button>Edit Profile</Button>
    </Card.Footer>
  </Card>
  )
}
```

#### `Badge`

Badge component for status indicators and labels.

```typescript
import { Badge } from '@hubble/ui'

function StatusBadges() {
  return (
  <div className="space-x-2">
    <Badge variant="success">Active</Badge>
    <Badge variant="warning">Pending</Badge>
    <Badge variant="error">Failed</Badge>
    <Badge variant="info">Info</Badge>
  </div>
  )
}
```

#### `Avatar`

Avatar component with fallback and image support.

```typescript
import { Avatar } from '@hubble/ui'

function UserAvatar() {
  return (
  <div className="flex items-center space-x-2">
    <Avatar
      src="/user-avatar.jpg"
      alt="User Avatar"
      fallback="JD"
      size="md"
    />
    <span>John Doe</span>
  </div>
  )
}
```

### Navigation Components

#### `Tabs`

Tabs component with keyboard navigation and accessibility.

```typescript
import { Tabs } from '@hubble/ui'

function SettingsTabs() {
  return (
  <Tabs defaultValue="profile" className="w-full">
    <Tabs.List>
      <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
      <Tabs.Trigger value="account">Account</Tabs.Trigger>
      <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="profile">
      <p>Profile settings content</p>
    </Tabs.Content>
    <Tabs.Content value="account">
      <p>Account settings content</p>
    </Tabs.Content>
    <Tabs.Content value="billing">
      <p>Billing settings content</p>
    </Tabs.Content>
  </Tabs>
  )
}
```

#### `Breadcrumb`

Breadcrumb component for navigation hierarchy.

```typescript
import { Breadcrumb } from '@hubble/ui'

function NavigationBreadcrumb() {
  return (
  <Breadcrumb>
    <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
    <Breadcrumb.Item href="/dashboard">Dashboard</Breadcrumb.Item>
    <Breadcrumb.Item href="/dashboard/settings">Settings</Breadcrumb.Item>
    <Breadcrumb.Item current>Profile</Breadcrumb.Item>
  </Breadcrumb>
  )
}
```

#### `Pagination`

Pagination component with page navigation and info.

```typescript
import { Pagination } from '@hubble/ui'

function DataPagination() {
  return (
  <Pagination
    currentPage={1}
    totalPages={10}
    onPageChange={(page) => console.log('Page changed:', page)}
    showInfo
    showFirstLast
  />
  )
}
```

### Feedback Components

#### `Alert`

Alert component for important messages and notifications.

```typescript
import { Alert } from '@hubble/ui'

function Notifications() {
  return (
  <div className="space-y-4">
    <Alert variant="success" title="Success">
      Your changes have been saved successfully.
    </Alert>
    <Alert variant="warning" title="Warning">
      Please review your settings before proceeding.
    </Alert>
    <Alert variant="error" title="Error">
      Something went wrong. Please try again.
    </Alert>
  </div>
  )
}
```

#### `Toast`

Toast component for temporary notifications.

```typescript
import { Toast, useToast } from '@hubble/ui'

function NotificationExample() {
  const { toast } = useToast()

  const showToast = () => {
  toast({
    title: 'Success',
    description: 'Operation completed successfully',
    variant: 'success'
  })
  }

  return (
  <div>
    <Button onClick={showToast}>Show Toast</Button>
    <Toast />
  </div>
  )
}
```

#### `Modal`

Modal component with backdrop and focus management.

```typescript
import { Modal, useModal } from '@hubble/ui'

function ConfirmationModal() {
  const { isOpen, open, close } = useModal()

  return (
  <div>
    <Button onClick={open}>Open Modal</Button>

    <Modal isOpen={isOpen} onClose={close}>
      <Modal.Header>
        <Modal.Title>Confirm Action</Modal.Title>
        <Modal.Description>
          Are you sure you want to delete this item?
        </Modal.Description>
      </Modal.Header>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={close}>
          Delete
        </Button>
      </Modal.Footer>
    </Modal>
  </div>
  )
}
```

#### `Tooltip`

Tooltip component for contextual information.

```typescript
import { Tooltip } from '@hubble/ui'

function HelpfulTooltip() {
  return (
  <Tooltip content="This is a helpful tooltip">
    <Button>Hover me</Button>
  </Tooltip>
  )
}
```

### Loading Components

#### `Spinner`

Spinner component for loading states.

```typescript
import { Spinner } from '@hubble/ui'

function LoadingState() {
  return (
  <div className="flex items-center justify-center p-8">
    <Spinner size="lg" />
    <span className="ml-2">Loading...</span>
  </div>
  )
}
```

#### `Skeleton`

Skeleton component for loading placeholders.

```typescript
import { Skeleton } from '@hubble/ui'

function LoadingCard() {
  return (
  <Card className="w-80">
    <Card.Header>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-48" />
    </Card.Header>
    <Card.Content>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4" />
    </Card.Content>
  </Card>
  )
}
```

#### `Progress`

Progress component for task completion indicators.

```typescript
import { Progress } from '@hubble/ui'

function TaskProgress() {
  return (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span>Task Progress</span>
      <span>75%</span>
    </div>
    <Progress value={75} className="w-full" />
  </div>
  )
}
```

### Utility Components

#### `Separator`

Separator component for visual division.

```typescript
import { Separator } from '@hubble/ui'

function SectionDivider() {
  return (
  <div>
    <h2>Section 1</h2>
    <p>Content for section 1</p>
    <Separator className="my-4" />
    <h2>Section 2</h2>
    <p>Content for section 2</p>
  </div>
  )
}
```

#### `ScrollArea`

Scrollable area component with custom scrollbars.

```typescript
import { ScrollArea } from '@hubble/ui'

function ScrollableContent() {
  return (
  <ScrollArea className="h-64 w-full">
    <div className="p-4">
      {/* Long content that will scroll */}
      <p>Content goes here...</p>
    </div>
  </ScrollArea>
  )
}
```

#### `Collapsible`

Collapsible component for expandable content.

```typescript
import { Collapsible } from '@hubble/ui'

function ExpandableSection() {
  return (
  <Collapsible>
    <Collapsible.Trigger>
      <Button variant="ghost">Toggle Section</Button>
    </Collapsible.Trigger>
    <Collapsible.Content>
      <p>This content can be expanded and collapsed.</p>
    </Collapsible.Content>
  </Collapsible>
  )
}
```

## Usage Examples

### Complete Form

```typescript
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Card,
  Form
} from '@hubble/ui'

function ContactForm() {
  return (
  <Card className="w-full max-w-md mx-auto">
    <Card.Header>
      <Card.Title>Contact Us</Card.Title>
      <Card.Description>
        Send us a message and we'll get back to you.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <Form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Your name"
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="your@email.com"
            required
          />
          <Select
            label="Subject"
            placeholder="Select a subject"
            options={[
              { value: 'general', label: 'General Inquiry' },
              { value: 'support', label: 'Technical Support' },
              { value: 'billing', label: 'Billing Question' }
            ]}
          />
          <Textarea
            label="Message"
            placeholder="Your message here..."
            rows={4}
            required
          />
          <Checkbox
            label="I agree to the terms and conditions"
            required
          />
        </div>
        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="secondary" type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Send Message
          </Button>
        </div>
      </Form>
    </Card.Content>
  </Card>
  )
}
```

### Data Dashboard

```typescript
import {
  Card,
  Table,
  Badge,
  Button,
  Modal,
  Tabs,
  Grid
} from '@hubble/ui'

function Dashboard() {
  return (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

    <Grid cols={3} gap={6} className="mb-8">
      <Card>
        <Card.Header>
          <Card.Title>Total Users</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="text-3xl font-bold">1,234</div>
          <p className="text-sm text-muted-foreground">
            +12% from last month
          </p>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Active Sessions</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="text-3xl font-bold">89</div>
          <p className="text-sm text-muted-foreground">
            +5% from last hour
          </p>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Revenue</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="text-3xl font-bold">$12,345</div>
          <p className="text-sm text-muted-foreground">
            +8% from last month
          </p>
        </Card.Content>
      </Card>
    </Grid>

    <Tabs defaultValue="users" className="w-full">
      <Tabs.List>
        <Tabs.Trigger value="users">Users</Tabs.Trigger>
        <Tabs.Trigger value="sessions">Sessions</Tabs.Trigger>
        <Tabs.Trigger value="analytics">Analytics</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="users">
        <Card>
          <Card.Header>
            <Card.Title>User Management</Card.Title>
            <Card.Description>
              Manage your users and their permissions
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Table
              columns={[
                { key: 'name', label: 'Name', sortable: true },
                { key: 'email', label: 'Email', sortable: true },
                { key: 'status', label: 'Status', sortable: false },
                { key: 'actions', label: 'Actions', sortable: false }
              ]}
              data={users.map(user => ({
                ...user,
                status: (
                  <Badge variant={user.active ? 'success' : 'error'}>
                    {user.active ? 'Active' : 'Inactive'}
                  </Badge>
                ),
                actions: (
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm">
                      Delete
                    </Button>
                  </div>
                )
              }))}
              pagination
              pageSize={10}
            />
          </Card.Content>
        </Card>
      </Tabs.Content>
    </Tabs>
  </div>
  )
}
```

### Navigation Layout

```typescript
import {
  Button,
  Avatar,
  DropdownMenu,
  Separator,
  Badge
} from '@hubble/ui'

function Navigation() {
  return (
  <header className="border-b">
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold">Hubble</h1>
        <nav className="hidden md:flex space-x-6">
          <a href="/dashboard" className="text-sm font-medium">
            Dashboard
          </a>
          <a href="/analytics" className="text-sm font-medium">
            Analytics
          </a>
          <a href="/settings" className="text-sm font-medium">
            Settings
          </a>
        </nav>
      </div>

      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm">
          <Badge variant="error" className="absolute -top-1 -right-1">
            3
          </Badge>
          Notifications
        </Button>

        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <Avatar.Image src="/user-avatar.jpg" alt="User" />
                <Avatar.Fallback>JD</Avatar.Fallback>
              </Avatar>
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content className="w-56">
            <DropdownMenu.Label>My Account</DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>Profile</DropdownMenu.Item>
            <DropdownMenu.Item>Settings</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>Logout</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </div>
  </header>
  )
}
```

## Configuration

### Tailwind CSS Setup

```typescript
// tailwind.config.js
module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx}", "./node_modules/@hubble/ui/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: "#eff6ff",
                    500: "#3b82f6",
                    900: "#1e3a8a",
                },
            },
        },
    },
    plugins: [require("@hubble/ui/tailwind")],
}
```

### CSS Variables

```css
/* globals.css */
@import "@hubble/ui/styles.css";

:root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
}
```

## Testing

### Component Testing

```typescript
import { render, screen } from '@testing-library/react'
import { Button } from '@hubble/ui'

describe('Button Component', () => {
  it('should render with correct text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('should apply correct variant classes', () => {
  render(<Button variant="primary">Primary</Button>)
  expect(screen.getByRole('button')).toHaveClass('bg-primary')
  })
})
```

### Accessibility Testing

```typescript
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from '@hubble/ui'

expect.extend(toHaveNoViolations)

describe('Button Accessibility', () => {
  it('should not have accessibility violations', async () => {
  const { container } = render(<Button>Click me</Button>)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
  })
})
```

## Migration Guide

### From v0.x to v1.x

1. **Component Names**: Update component import names
2. **Props**: Update prop names and types
3. **Styling**: Update CSS class names

```typescript
// Before (v0.x)
import { Button, Input, Card } from "@hubble/ui"

// After (v1.x)
import { Button, Input, Card } from "@hubble/ui"
// Component names remain the same, but props may have changed
```

## Troubleshooting

### Common Issues

1. **Styling Issues**

- Check Tailwind CSS configuration
- Verify CSS imports
- Review component class names

2. **TypeScript Errors**

- Check component prop types
- Verify import statements
- Review type definitions

3. **Accessibility Issues**

- Check ARIA attributes
- Verify keyboard navigation
- Review screen reader support

### Debug Mode

Enable component debugging:

```env
REACT_APP_UI_DEBUG=true
```

## Contributing

When contributing to `@hubble/ui`:

1. **Follow Patterns**: Maintain consistency with existing components
2. **Add Tests**: Include comprehensive tests for new components
3. **Update Types**: Ensure TypeScript types are accurate
4. **Document Changes**: Update this documentation for new features

## Related Packages

- [**@hubble/types**](./types.md) - Shared TypeScript types
- [**@hubble/core**](./core.md) - Core utilities and error handling
