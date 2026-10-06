import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FindOrdersDto } from './dto/find-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Roles } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(req.user.id, createOrderDto);
  }

  // Оголошено до @Get(':id'), інакше «my» сприймалося б як id
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMy(@Request() req) {
    return this.orderService.findUserOrders(req.user.id);
  }

  @Get()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  findAll(@Query() query: FindOrdersDto) {
    return this.orderService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.orderService.findOneForUser(id, req.user);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() { status }: UpdateOrderStatusDto) {
    return this.orderService.updateStatus(id, status);
  }

  @Patch()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  update(@Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.update(updateOrderDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.remove(id);
  }
}
