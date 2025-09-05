export const runtime = "edge"

// Import version from package.json at build time
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import
import packageJson from "../../../package.json"

export async function GET() {
  return Response.json({ version: packageJson.version })
}
