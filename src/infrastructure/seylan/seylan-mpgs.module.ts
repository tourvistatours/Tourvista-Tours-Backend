import { Module } from '@nestjs/common';
import { SeylanMpgsService } from './seylan-mpgs.service';
import { SeylanMpgsProvider } from '../providers/seylan-mpgs.provider';

@Module({
  providers: [SeylanMpgsProvider, SeylanMpgsService],
  exports: [SeylanMpgsService],
})
export class SeylanMpgsModule {}
