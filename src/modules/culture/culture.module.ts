import { Module } from '@nestjs/common';
import { CultureService } from './culture.service';
import { CultureController } from './culture.controller';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  controllers: [CultureController],
  providers: [CultureService],
})
export class CultureModule {}
