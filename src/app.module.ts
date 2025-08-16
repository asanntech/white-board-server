import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
@Module({
  imports: [
    ConfigModule.forRoot(), // 環境変数の設定を有効にする
    AuthModule,
    PrismaModule,
  ],
})
export class AppModule {}
