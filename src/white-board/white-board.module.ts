import { Module } from '@nestjs/common'
import { DynamoDBService } from './dynamodb.service'
import { S3Service } from './s3.service'

@Module({
  providers: [DynamoDBService, S3Service],
  exports: [DynamoDBService, S3Service],
})
export class WhiteBoardModule {}
