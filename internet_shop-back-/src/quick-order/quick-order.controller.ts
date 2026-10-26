import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateQuickOrderDto } from './dto/create-quick-order.dto';
import { QuickOrderService } from './quick-order.service';
import {
  QUICK_ORDER_LIMIT,
  QUICK_ORDER_TTL,
  QuickOrderThrottlerGuard,
} from './throttling';
import { ParseIdPipe } from '../common/parse-id.pipe';

const QUICK_ORDER_NOT_FOUND = new ParseIdPipe('Заявку не знайдено');

@Controller('quick-order')
export class QuickOrderController {
  constructor(private readonly quickOrderService: QuickOrderService) {}

  // Без авторизації: «в 1 клік» замовляють і гості.
  // Ліміт заявок, щоб не засипати адмінку з одного IP
  @UseGuards(QuickOrderThrottlerGuard)
  @Throttle({
    default: { limit: QUICK_ORDER_LIMIT, ttl: QUICK_ORDER_TTL },
  })
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
