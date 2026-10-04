import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  UseGuards,
  Delete,
  Post,
} from '@nestjs/common';
import { UsersService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { productToBasketDto } from './dto/productToBasket.dto';
import { SyncCartDto } from './dto/sync-cart.dto';
import { Roles } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
export class UserController {
  constructor(private userService: UsersService) {}

  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('order/:id')
  findOrders(@Param('id') id: string) {
    return this.userService.findOrders(+id);
  }

  @Patch('/addProduct')
  addProductToBasket(@Body() dto: productToBasketDto) {
    return this.userService.addProductToBasket(dto);
  }

  @Patch('/pickUpFromTheBasket')
  pickUpFromTheBasket(@Body() dto: productToBasketDto) {
    return this.userService.pickUpFromTheBasket(dto);
  }

  @Post('/syncCart')
  syncCart(@Body() dto: SyncCartDto) {
    return this.userService.syncCart(dto.idUser, dto.items);
  }

  @Delete('/basket/:id')
  cleanTheBasket(@Param('id') id: string) {
    return this.userService.cleanTheBasket(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(+id);
  }
}
