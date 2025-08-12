import { Controller, Get, UseGuards } from '@nestjs/common'
import { AppService } from './app.service'
import { AuthGuard } from './auth/auth.guard'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('Get Hello')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @UseGuards(AuthGuard)
  // @ApiOperation({ summary: 'Get Hello' })
  getHello(): string {
    return this.appService.getHello()
  }
}
