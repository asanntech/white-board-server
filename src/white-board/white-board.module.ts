import { Module } from '@nestjs/common'
import { WhiteBoardGateway } from './white-board.gateway'
import { AuthModule } from '../auth/auth.module'
import { DynamoDBService } from './dynamodb.service'
import { S3Service } from './s3.service'

@Module({
  imports: [AuthModule],
  providers: [WhiteBoardGateway, DynamoDBService, S3Service],
  exports: [DynamoDBService],
})
export class WhiteBoardModule {}
