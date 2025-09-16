import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'
import * as jwksClient from 'jwks-rsa'
import { Request } from 'express'
import { AuthVerifyResponseDto } from './auth.dto'
import { UserService } from '../user/user.service'

@Injectable()
export class AuthService {
  private client: jwksClient.JwksClient

  constructor(private readonly userService: UserService) {
    this.client = jwksClient({
      jwksUri: `${process.env.COGNITO_ISSUER}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 10,
      cacheMaxAge: 60 * 15,
      timeout: 5000,
    })
  }

  extractToken(request: Request): string | null {
    const authHeader = request.headers['authorization']
    if (!authHeader?.startsWith('Bearer ')) return null
    return authHeader.replace('Bearer ', '')
  }

  async verifyToken(token: string): Promise<jwt.JwtPayload> {
    const decoded = jwt.decode(token, { complete: true })

    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      throw new BadRequestException('Invalid token format')
    }

    try {
      const key = await this.client.getSigningKey(decoded.header.kid)
      const publicKey = key.getPublicKey()

      const res = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: process.env.COGNITO_ISSUER,
      })

      if (typeof res === 'string') {
        throw new UnauthorizedException('Unexpected JWT payload type')
      }

      return res
    } catch {
      throw new UnauthorizedException('Token verification failed')
    }
  }

  async validateToken(request: Request): Promise<jwt.JwtPayload> {
    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException('Token not found')
    return await this.verifyToken(token)
  }

  async verifyAndUpsertUser(idToken: string): Promise<AuthVerifyResponseDto> {
    const payload = await this.verifyToken(idToken)
    const authInfo = new AuthVerifyResponseDto(payload)

    const user = await this.userService.findById(authInfo.id)
    if (!user) {
      await this.userService.create({
        id: authInfo.id,
        firstName: authInfo.firstName,
        lastName: authInfo.lastName,
        email: authInfo.email,
      })
    }

    return authInfo
  }
}
