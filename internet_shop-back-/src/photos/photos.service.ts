import { Injectable } from '@nestjs/common';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PhotoEntity } from './entities/photo.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(PhotoEntity)
    private PhotoRepository: Repository<PhotoEntity>,
  ) {}

  async create(createPhotoDto: CreatePhotoDto) {
    // create(), а не звичайний об'єкт: тоді save повертає сутність, і url
    // серіалізується у повний URL із поточного BASE_URL.
    return await this.PhotoRepository.save(
      this.PhotoRepository.create(createPhotoDto),
    );
  }

  async remove(id: number) {
    return await this.PhotoRepository.delete(id);
  }
}
