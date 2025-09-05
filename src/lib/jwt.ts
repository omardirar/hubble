import { SignJWT, importPKCS8, type KeyLike } from "jose"
import { createPrivateKey } from "crypto"

function getEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

async function importPrivateKeyFromPEM(pem: string): Promise<KeyLike> {
  if (pem.includes("BEGIN PRIVATE KEY")) {
    return importPKCS8(pem, "RS256")
  }
  if (pem.includes("BEGIN RSA PRIVATE KEY")) {
    // Fallback: parse PKCS#1 via Node's crypto and return the KeyObject
    return createPrivateKey({ key: pem, format: "pem" })
  }
  throw new Error("Unsupported private key format. Expected PKCS#8 or PKCS#1 PEM.")
}

export async function signDbJwtRS256({ sub, db }: { sub: string; db: string }): Promise<string> {
  const issuer = getEnv("MCP_JWT_ISSUER")
  const audience = getEnv("MCP_JWT_AUDIENCE")
  const pem = getEnv("MCP_JWT_PRIVATE_KEY")

  const privateKey = await importPrivateKeyFromPEM(pem)

  const jwt = await new SignJWT({ db })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("90s")
    .sign(privateKey)

  return jwt
}
