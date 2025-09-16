"use client"

import { SignUp } from "@clerk/nextjs"
import { ChartLine, Clock, Funnel, Telescope } from "lucide-react"

export function ClerkSignUp() {
  return (
    <div className="bg-muted grid flex-1 lg:grid-cols-2">
      <div className="hidden flex-1 items-center justify-end p-6 md:p-10 lg:flex">
        <ul className="max-w-sm space-y-8">
          <li>
            <div className="flex items-center gap-2">
              <Clock className="size-4" />
              <p className="font-semibold">Save time making reports</p>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Generate reports with just a few natural language prompts.
            </p>
          </li>
          <li>
            <div className="flex items-center gap-2">
              <ChartLine className="size-4" />
              <p className="font-semibold">Improve campaign performance</p>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Improve campaign performance with AI-powered insights and recommendations.
            </p>
          </li>
          <li>
            <div className="flex items-center gap-2">
              <Funnel className="size-4" />
              <p className="font-semibold">Centralize your data</p>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Connect your data to multiple sources to get a complete view of your campaign.
            </p>
          </li>
          <li>
            <div className="flex items-center gap-2">
              <Telescope className="size-4" />
              <p className="font-semibold">...and more</p>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              With features like forecasting, media planning, marketing mix modeling, market
              research, and more currently in development.
            </p>
          </li>
        </ul>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 md:p-10 lg:justify-start">
        <SignUp />
      </div>
    </div>
  )
}
