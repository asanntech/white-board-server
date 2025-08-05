import { Controller, Get, UseGuards } from '@nestjs/common'
import { AppService } from './app.service'
import { AuthService } from './auth/auth.service'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('Get Hello')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @UseGuards(AuthService)
  // @ApiOperation({ summary: 'Get Hello' })
  getHello(): string {
    return this.appService.getHello()
  }
}
