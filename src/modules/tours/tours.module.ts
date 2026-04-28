import { Module } from '@nestjs/common';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  controllers: [ToursController],
  providers: [ToursService],
})
export class ToursModule {}
