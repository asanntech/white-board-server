import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from './auth.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.SKIP_AUTH === 'true') return true

    const contextType = context.getType()

    if (contextType === 'http') {
      return this.validateHttp(context)
    }

    // WebSocket は y-websocket サーバーで別途認証を行うため、ここでは false を返す
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
}
