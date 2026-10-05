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
  remove(@Param('id') id: string) {
    return this.photosService.remove(+id);
  }
}
