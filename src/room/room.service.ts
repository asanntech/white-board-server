import { Injectable } from '@nestjs/common'
import { Room } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRoomDto } from './room.dto'

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  async create(room: CreateRoomDto): Promise<Room> {
    return await this.prisma.room.create({ data: room })
  }

  async findById(id: string): Promise<Room | null> {
    return await this.prisma.room.findUnique({ where: { id } })
  }
}
