import { Body, Controller, Post, Req, UnauthorizedException, HttpCode } from '@nestjs/common'
import { AuthService } from './auth.service'
import { ApiOperation, ApiTags, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { Request } from 'express'
import { AuthVerifyRequestDto, AuthVerifyResponseDto } from './auth.dto'

@ApiTags()
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify Token' })
  @ApiOkResponse({ type: AuthVerifyResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async verify(
    @Req() request: Request,
    @Body() authVerifyDto: AuthVerifyRequestDto
  ): Promise<AuthVerifyResponseDto> {
    await this.authService.validateToken(request)

    if (!authVerifyDto.idToken) {
      throw new UnauthorizedException('No valid token provided')
    }

    const payload = await this.authService.verifyToken(authVerifyDto.idToken)
    return new AuthVerifyResponseDto(payload)
  }
}
