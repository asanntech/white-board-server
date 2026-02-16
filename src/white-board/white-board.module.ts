import { Module } from '@nestjs/common'
import { WhiteBoardGateway } from './white-board.gateway'
import { AuthModule } from '../auth/auth.module'
import { DynamoDBService } from './dynamodb.service'
import { S3Service } from './s3.service'
import { YjsGateway } from './yjs/yjs.gateway'
import { YjsRoomManager } from './yjs/yjs-room.manager'
import { YjsPersistenceService } from './yjs/yjs-persistence.service'

@Module({
  imports: [AuthModule],
  providers: [
    // 既存（Phase 6で削除予定）
    WhiteBoardGateway,
    // Yjs
    YjsGateway,
    YjsRoomManager,
    YjsPersistenceService,
    // 共通
    DynamoDBService,
    S3Service,
  ],
  exports: [DynamoDBService, YjsRoomManager],
})
export class WhiteBoardModule {}
