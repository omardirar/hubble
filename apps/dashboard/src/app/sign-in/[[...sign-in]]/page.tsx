// TODO: Fix Clerk shadcn theme not loading in preview/production
//   Context: Clerk components lose shadcn theme styling in preview/production builds but work in dev. Investigate CSS bundling with Tailwind v4 and Clerk themes.
//   labels: area/web, feature/auth, type/bug
//   assignees: omzification
//   milestone: 0.0.1

import { ClerkSignIn } from "@hubble/ui"

export default function SignInPage() {
  return <ClerkSignIn />
}
