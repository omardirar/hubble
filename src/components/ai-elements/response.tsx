'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

// TODO: Add a11y: ensure headings have a logical order; provide landmark roles
//  labels: area:ui, accessibility, P3
//  assignees: me
//  milestone: M3 - Perf & DX
//  evidence: src/components/ai-elements/response.tsx — renders markdown without a11y audit

Response.displayName = 'Response';
