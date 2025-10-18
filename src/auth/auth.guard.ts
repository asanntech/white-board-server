import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'
import { Request } from 'express'
import { Socket } from 'socket.io'
import { AuthService } from './auth.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.SKIP_AUTH === 'true') return true

    const contextType = context.getType()

    if (contextType === 'http') {
      return this.validateHttp(context)
    } else if (contextType === 'ws') {
      return this.validateWebSocket(context)
    }

    return false
  }

  private async validateHttp(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest<Request>()
      const payload = await this.authService.validateToken(request)
      return !!payload
    } catch (error) {
      console.error('validateHttp', error)
      return false
    }
  }

  private async validateWebSocket(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient()
      const auth = client.handshake.auth
      if (!auth.token) {
        throw new WsException('認証トークンが提供されていません')
      }

      const payload = await this.authService.verifyToken(auth.token as string)
      if (!payload) {
        throw new WsException('無効な認証トークンです')
      }

      return true
    } catch (error) {
      console.error('validateWebSocket', error)
      throw new WsException('認証に失敗しました')
    }
  }
}
