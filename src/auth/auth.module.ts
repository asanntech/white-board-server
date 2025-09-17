import { Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { UsersModule } from '../user/user.module'
import { RoomModule } from '../room/room.module'

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
  imports: [UsersModule, RoomModule],
})
export class AuthModule {}
