import { DynamoDBService } from '../white-board/dynamodb.service'
import { S3Service } from '../white-board/s3.service'

/**
 * y-websocket サーバー用の DynamoDBService インスタンスを作成
 * NestJS の DI コンテナ外でも使用可能
 */
export function createDynamoDBService(): DynamoDBService {
  const s3Service = new S3Service()
  return new DynamoDBService(s3Service)
}

/**
 * y-websocket サーバー用の S3Service インスタンスを作成
 * NestJS の DI コンテナ外でも使用可能
 */
export function createS3Service(): S3Service {
  return new S3Service()
}
