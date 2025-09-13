import { Module } from '@nestjs/common'
import { WhiteBoardGateway } from './white-board.gateway'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  providers: [WhiteBoardGateway],
})
export class WhiteBoardModule {}
