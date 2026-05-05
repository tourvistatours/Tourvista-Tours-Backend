import { Test, TestingModule } from '@nestjs/testing';
import { CultureController } from './culture.controller';
import { CultureService } from './culture.service';

describe('CultureController', () => {
  let controller: CultureController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CultureController],
      providers: [CultureService],
    }).compile();

    controller = module.get<CultureController>(CultureController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
