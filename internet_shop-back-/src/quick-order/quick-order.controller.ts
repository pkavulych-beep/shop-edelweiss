import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateQuickOrderDto } from './dto/create-quick-order.dto';
import { QuickOrderService } from './quick-order.service';
import { ParseIdPipe } from '../common/parse-id.pipe';

const QUICK_ORDER_NOT_FOUND = new ParseIdPipe('Заявку не знайдено');

@Controller('quick-order')
export class QuickOrderController {
  constructor(private readonly quickOrderService: QuickOrderService) {}

  // Без авторизації: «в 1 клік» замовляють і гості
  @Post()
  create(@Body() dto: CreateQuickOrderDto) {
    return this.quickOrderService.create(dto);
  }

  @Get()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  findAll() {
    return this.quickOrderService.findAll();
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  remove(@Param('id', QUICK_ORDER_NOT_FOUND) id: number) {
    return this.quickOrderService.remove(id);
  }
}
