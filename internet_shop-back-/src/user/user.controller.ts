import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
  Delete,
  Post,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { productToBasketDto } from './dto/productToBasket.dto';
import { SyncCartDto } from './dto/sync-cart.dto';
import { Roles } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type AuthUser = { id: number; roles?: { value: string }[] };

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private userService: UsersService) {}

  // Дані іншого користувача доступні лише йому самому або адміну
  private assertOwnerOrAdmin(user: AuthUser, id: number) {
    const isAdmin = user.roles?.some((role) => role.value === 'ADMIN');
    if (user.id !== id && !isAdmin) {
      throw new ForbiddenException('Немає доступу');
    }
  }

  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('order/:id')
  findOrders(@Request() req, @Param('id', ParseIntPipe) id: number) {
    this.assertOwnerOrAdmin(req.user, id);
    return this.userService.findOrders(id);
  }

  @Patch('/addProduct')
  addProductToBasket(@Request() req, @Body() dto: productToBasketDto) {
    return this.userService.addProductToBasket(req.user.id, dto);
  }

  @Patch('/pickUpFromTheBasket')
  pickUpFromTheBasket(@Request() req, @Body() dto: productToBasketDto) {
    return this.userService.pickUpFromTheBasket(req.user.id, dto);
  }

  @Post('/syncCart')
  syncCart(@Request() req, @Body() dto: SyncCartDto) {
    return this.userService.syncCart(req.user.id, dto.items);
  }

  @Delete('/basket/:id')
  cleanTheBasket(@Request() req, @Param('id', ParseIntPipe) id: number) {
    this.assertOwnerOrAdmin(req.user, id);
    return this.userService.cleanTheBasket(id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    this.assertOwnerOrAdmin(req.user, id);
    return this.userService.update(id, updateUserDto);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    this.assertOwnerOrAdmin(req.user, id);
    return this.userService.findById(id);
  }
}
