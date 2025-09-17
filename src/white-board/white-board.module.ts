import { Module } from '@nestjs/common'
import { WhiteBoardGateway } from './white-board.gateway'
import { AuthModule } from '../auth/auth.module'
import { DynamoDBService } from './dynamodb.service'

@Module({
  imports: [AuthModule],
  providers: [WhiteBoardGateway, DynamoDBService],
  exports: [DynamoDBService],
})
export class WhiteBoardModule {}
