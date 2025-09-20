"use client"

import { cn } from "@hubble/utils"
import { motion, MotionProps } from "motion/react"
import { useEffect, useRef, useState } from "react"
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Database,
  Key,
  Server,
  Zap,
  AlertCircle,
} from "lucide-react"

interface AnimatedSpanProps extends MotionProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

export const AnimatedSpan = ({ children, delay = 0, className, ...props }: AnimatedSpanProps) => (
  <motion.div
    initial={{ opacity: 0, y: -5 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: delay / 1000 }}
    className={cn("grid text-sm font-normal tracking-tight", className)}
    {...props}
  >
    {children}
  </motion.div>
)

interface StepIconProps {
  step: string
  status: "started" | "succeeded" | "failed"
  className?: string
}

export const StepIcon = ({ step, status, className }: StepIconProps) => {
  const getIcon = () => {
    switch (step) {
      case "CREATE_SERVICE_ACCOUNT":
        return <Key className="h-4 w-4" />
      case "ISSUE_SA_TOKEN":
        return <Key className="h-4 w-4" />
      case "CREATE_TENANT_DATABASE":
        return <Database className="h-4 w-4" />
      case "CONFIGURE_COMPUTE":
        return <Server className="h-4 w-4" />
      case "CREATE_FIVETRAN_GROUP":
        return <Zap className="h-4 w-4" />
      case "CREATE_FIVETRAN_DESTINATION":
        return <Zap className="h-4 w-4" />
      case "TEST_DESTINATION":
        return <Zap className="h-4 w-4" />
      case "ERROR":
        return <AlertCircle className="h-4 w-4" />
      case "READY":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Loader2 className="h-4 w-4" />
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case "succeeded":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "started":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {status === "started" ? getIcon() : getStatusIcon()}
    </div>
  )
}

interface TypingAnimationProps extends MotionProps {
  children: string
  className?: string
  duration?: number
  delay?: number
  as?: React.ElementType
}

export const TypingAnimation = ({
  children,
  className,
  duration = 60,
  delay = 0,
  as: Component = "span",
  ...props
}: TypingAnimationProps) => {
  if (typeof children !== "string") {
    throw new Error("TypingAnimation: children must be a string. Received:")
  }
  const MotionComponent = motion.create(Component, {
    forwardMotionProps: true,
  })
  const [displayedText, setDisplayedText] = useState<string>("")
  const [started, setStarted] = useState(false)
  const elementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      setStarted(true)
    }, delay)
    return () => clearTimeout(startTimeout)
  }, [delay])

  useEffect(() => {
    if (!started) return
    let i = 0
    const typingEffect = setInterval(() => {
      if (i < children.length) {
        setDisplayedText(children.substring(0, i + 1))
        i++
      } else {
        clearInterval(typingEffect)
      }
    }, duration)
    return () => {
      clearInterval(typingEffect)
    }
  }, [children, duration, started])

  return (
    <MotionComponent
      ref={elementRef}
      className={cn("text-sm font-normal tracking-tight", className)}
      {...props}
    >
      {displayedText}
    </MotionComponent>
  )
}

interface ProgressBarProps {
  completed: number
  total: number
  className?: string
}

export const ProgressBar = ({ completed, total, className }: ProgressBarProps) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className={cn("w-full bg-gray-200 rounded-full h-2", className)}>
      <motion.div
        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  )
}

interface StepItemProps {
  step: string
  status: "started" | "succeeded" | "failed"
  message?: string
  timestamp?: string
  eventSeq?: number
  delay?: number
}

export const StepItem = ({
  step,
  status,
  message,
  timestamp,
  eventSeq,
  delay = 0,
}: StepItemProps) => {
  const getStepDescription = (step: string) => {
    const descriptions: Record<string, string> = {
      CREATE_SERVICE_ACCOUNT: "Creating MotherDuck service account",
      ISSUE_SA_TOKEN: "Issuing authentication token",
      CREATE_TENANT_DATABASE: "Creating tenant database",
      CONFIGURE_COMPUTE: "Configuring compute resources",
      CREATE_FIVETRAN_GROUP: "Creating Fivetran group",
      CREATE_FIVETRAN_DESTINATION: "Setting up Fivetran destination",
      TEST_DESTINATION: "Testing data connection",
      ERROR: "Error occurred",
      READY: "Provisioning complete",
    }
    return descriptions[step] || step.replace(/_/g, " ").toLowerCase()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded":
        return "text-green-500"
      case "failed":
        return "text-red-500"
      case "started":
        return "text-yellow-500"
      default:
        return "text-blue-500"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000 }}
      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 border border-gray-200/50"
    >
      <StepIcon step={step} status={status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900">{getStepDescription(step)}</span>
          <span className={cn("text-xs font-medium", getStatusColor(status))}>
            {status.toUpperCase()}
          </span>
        </div>
        {message && <p className="text-xs text-gray-600 mb-1">{message}</p>}
        {timestamp && (
          <p className="text-xs text-gray-400">
            {new Date(timestamp).toLocaleTimeString()}
            {eventSeq && ` • Event #${eventSeq}`}
          </p>
        )}
      </div>
    </motion.div>
  )
}

interface TerminalProps {
  children: React.ReactNode
  className?: string
  progress?: { completed: number; total: number }
}

export const Terminal = ({ children, className, progress }: TerminalProps) => {
  return (
    <div
      className={cn(
        "z-0 h-full max-h-[600px] w-full max-w-4xl rounded-xl border border-border bg-background",
        className,
      )}
    >
      <div className="p-6">
        {progress && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Provisioning Progress</span>
              <span className="text-sm text-gray-500">
                {progress.completed} of {progress.total} steps
              </span>
            </div>
            <ProgressBar completed={progress.completed} total={progress.total} />
          </div>
        )}
        <div className="space-y-2 overflow-auto max-h-[500px]">{children}</div>
      </div>
    </div>
  )
}
