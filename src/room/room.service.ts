import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRoomDto } from './room.dto'

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoom(createRoomDto: CreateRoomDto) {
    const { name, createdBy } = createRoomDto

    const room = await this.prisma.room.create({ data: { name, createdBy } })

    return room
  }
}
