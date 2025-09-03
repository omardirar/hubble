import { SignJWT, importPKCS8, type KeyLike } from "jose"
import { createPrivateKey } from "crypto"
import { config } from "./config"

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

export async function signDbJwtRS256({
  sub,
  db,
}: {
  sub: string
  db: string
}): Promise<string> {
  const issuer = config.mcpJwtIssuer
  const audience = config.mcpJwtAudience
  const pem = config.mcpJwtPrivateKey

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


