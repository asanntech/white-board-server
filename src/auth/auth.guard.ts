import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from './auth.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.SKIP_AUTH === 'true') return true

    const request = context.switchToHttp().getRequest<Request>()
    const payload = await this.authService.validateToken(request)
    return !!payload
  }
}
