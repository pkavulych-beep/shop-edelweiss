import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ParseIdPipe } from '../common/parse-id.pipe';

const PAYMENT_NOT_FOUND = new ParseIdPipe('Інвойс не знайдено');

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':orderId/invoice')
  @UseGuards(JwtAuthGuard)
  async createInvoice(
    @Request() req: { user: { id: number } },
    @Param('orderId', PAYMENT_NOT_FOUND) orderId: number,
  ) {
    return this.paymentService.createInvoice(req.user.id, orderId);
  }

  @Post('webhook')
  async handleWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-sign') signature: string,
  ) {
    return this.paymentService.handleWebhook(body, signature);
  }

  @Post(':invoiceId/refund')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async refund(
    @Param('invoiceId', PAYMENT_NOT_FOUND) invoiceId: string,
    @Body() body: { amount?: number },
  ) {
    await this.paymentService.refund(invoiceId, body.amount);
    return { success: true };
  }
}