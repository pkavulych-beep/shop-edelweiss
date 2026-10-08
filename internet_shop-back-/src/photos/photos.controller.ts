import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PhotosService } from './photos.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { Roles } from 'src/auth/roles-auth.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ParseIdPipe } from '../common/parse-id.pipe';

const PHOTO_NOT_FOUND = new ParseIdPipe('Фото не знайдено');

@Controller('photos')
@Roles('ADMIN')
@UseGuards(RolesGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post()
  create(@Body() dto: CreatePhotoDto) {
    return this.photosService.create(dto);
  }

  @Delete(':id')
  remove(@Param('id', PHOTO_NOT_FOUND) id: number) {
    return this.photosService.remove(id);
  }
}
