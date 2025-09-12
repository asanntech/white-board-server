import { Test, TestingModule } from '@nestjs/testing'
import { WhiteBoardGateway } from './white-board.gateway'

describe('WhiteBoardGateway', () => {
  let gateway: WhiteBoardGateway

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhiteBoardGateway],
    }).compile()

    gateway = module.get<WhiteBoardGateway>(WhiteBoardGateway)
  })

  it('should be defined', () => {
    expect(gateway).toBeDefined()
  })
})
