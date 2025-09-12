import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { WhiteBoardGateway } from './white-board/white-board.gateway'

@Module({
  imports: [
    ConfigModule.forRoot(), // 環境変数の設定を有効にする
    AuthModule,
    PrismaModule,
  ],
  providers: [WhiteBoardGateway],
})
export class AppModule {}
