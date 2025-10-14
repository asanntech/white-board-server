import { DocumentBuilder } from '@nestjs/swagger'

export const documentConfig = new DocumentBuilder()
  .setTitle('API')
  .setDescription('APIドキュメント')
  .setVersion('1.0')
  .build()

export const operationIdFactory = (_: unknown, methodKey: string) => methodKey
