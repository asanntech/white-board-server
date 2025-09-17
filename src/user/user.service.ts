import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { User } from '@prisma/client'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>) {
    return await this.prisma.user.create({ data: user })
  }

  async findById(id: string) {
    return await this.prisma.user.findUnique({
      where: { id },
      include: { createdRooms: true, roomParticipants: true },
    })
  }
}
