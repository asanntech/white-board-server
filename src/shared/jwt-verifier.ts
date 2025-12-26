import * as jwt from 'jsonwebtoken'
import * as jwksClient from 'jwks-rsa'

const client = jwksClient({
  jwksUri: `${process.env.COGNITO_ISSUER}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 60 * 15,
  timeout: 5000,
})

export async function verifyToken(token: string): Promise<jwt.JwtPayload> {
  const decoded = jwt.decode(token, { complete: true })

  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new Error('ERR_INVALID_TOKEN_FORMAT')
  }

  try {
    const key = await client.getSigningKey(decoded.header.kid)
    const publicKey = key.getPublicKey()

    const res = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: process.env.COGNITO_ISSUER,
    })

    if (typeof res === 'string') {
      throw new Error('ERR_UNEXPECTED_JWT_PAYLOAD')
    }

    console.log('res', res)

    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('ERR_')) {
      throw error
    }
    throw new Error('ERR_TOKEN_VERIFICATION_FAILED')
  }
}
