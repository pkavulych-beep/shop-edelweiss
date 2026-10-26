import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { RefundPaymentDto } from './dto/refund-payment.dto';

// ':orderId' — числовий id замовлення, тож неіснуючий/позамежовий дає 404.
// ':invoiceId' — рядковий id інвойсу mono (наприклад, 'p2_9ZgpZVsl3'), його
// через ParseIdPipe пропускати не можна.
const ORDER_NOT_FOUND = new ParseIdPipe('Замовлення не знайдено');

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // Без авторизації: покупець має знати ще до входу, чи можна платити карткою
  @Get('methods')
  methods() {
    return this.paymentService.getMethods();
  }

  // Без guard'ів: справжність перевіряється підписом X-Sign над сирим тілом
  // (rawBody у main.ts), а не розпарсеним @Body(), який ValidationPipe ще й
  // обрізав би. Не 200 — mono повторить вебхук.
  @Post('webhook/mono')
  @HttpCode(200)
  async monoWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-sign') signature: string | undefined,
  ) {
    await this.paymentService.handleWebhook({ rawBody: req.rawBody, signature });
    return { success: true };
  }

  @Post(':orderId/invoice')
  @UseGuards(JwtAuthGuard)
  async createInvoice(
    @Request() req: { user: { id: number } },
    @Param('orderId', ORDER_NOT_FOUND) orderId: number,
  ) {
    return this.paymentService.createInvoice(req.user.id, orderId);
  }

  @Get('order/:orderId')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async getOrderPayment(@Param('orderId', ORDER_NOT_FOUND) orderId: number) {
    return this.paymentService.getOrderPayment(orderId);
  }

  @Post(':invoiceId/refund')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async refund(
    @Param('invoiceId') invoiceId: string,
    @Body() body: RefundPaymentDto,
  ) {
    await this.paymentService.refund(invoiceId, body.amount);
    return { success: true };
  }
}
