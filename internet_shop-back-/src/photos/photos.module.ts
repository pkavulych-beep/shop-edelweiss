import { forwardRef, Module } from '@nestjs/common';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoEntity } from './entities/photo.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PhotoEntity]),
    forwardRef(() => AuthModule),
  ],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
