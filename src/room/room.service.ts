import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRoomDto } from './room.dto'

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  async create(room: CreateRoomDto) {
    return await this.prisma.room.create({ data: room })
  }
}
