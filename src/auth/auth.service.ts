import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'
import { Request } from 'express'
import { AuthVerifyResponseDto } from './auth.dto'
import { UserService } from '../user/user.service'
import { RoomService } from '../room/room.service'
import { verifyToken } from '../shared/jwt-verifier'

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly roomService: RoomService
  ) {}

  extractToken(request: Request): string | null {
    const authHeader = request.headers['authorization']
    if (!authHeader?.startsWith('Bearer ')) return null
    return authHeader.replace('Bearer ', '')
  }

  async verifyToken(token: string): Promise<jwt.JwtPayload> {
    try {
      return await verifyToken(token)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ERR_TOKEN_VERIFICATION_FAILED'

      if (errorMessage === 'ERR_INVALID_TOKEN_FORMAT') {
      throw new BadRequestException('Invalid token format')
    }

      if (errorMessage === 'ERR_UNEXPECTED_JWT_PAYLOAD') {
        throw new UnauthorizedException('Unexpected JWT payload type')
      }

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

    const user = await this.userService.findById(authInfo.userId)

    if (user) {
      // ユーザーが作成したルームがある場合はそれを使用
      authInfo.roomId = user.createdRooms[0].id
    } else {
      // ユーザーが作成したルームがない場合は新規作成
      await this.userService.create({
        id: authInfo.userId,
        firstName: authInfo.firstName,
        lastName: authInfo.lastName,
        email: authInfo.email,
      })

      const room = await this.roomService.create({
        name: 'My Room',
        createdBy: authInfo.userId,
      })
      authInfo.roomId = room.id
    }

    return authInfo
  }
}
