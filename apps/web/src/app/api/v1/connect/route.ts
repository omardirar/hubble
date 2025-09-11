import { NextResponse } from "next/server"
import { startProvisioning } from "@hubble/workflows"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    // Start provisioning workflow
    const result = await startProvisioning({ body, env: process.env })

    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      status: result.status,
      message: "Provisioning started successfully",
    })
  } catch (error) {
    console.error("Connect endpoint error:", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
