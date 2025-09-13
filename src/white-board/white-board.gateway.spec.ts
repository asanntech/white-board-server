import { Test, TestingModule } from '@nestjs/testing'
import { WhiteBoardGateway } from './white-board.gateway'
import { AuthService } from '../auth/auth.service'
import { UserService } from '../user/user.service'

describe('WhiteBoardGateway', () => {
  let gateway: WhiteBoardGateway

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhiteBoardGateway,
        {
          provide: AuthService,
          useValue: {
            verifyToken: jest.fn(),
            validateToken: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile()

    gateway = module.get<WhiteBoardGateway>(WhiteBoardGateway)
  })

  it('should be defined', () => {
    expect(gateway).toBeDefined()
  })
})
