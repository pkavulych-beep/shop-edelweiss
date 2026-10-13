import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from 'src/order/entities/order.entity';
import { PaymentStatus } from 'src/order/paymentEnum';
import { OrderService } from 'src/order/order.service';
import { PaymentEntity } from './entities/payment.entity';
import { CreateInvoiceInput, PaymentProvider } from './providers/payment-provider.interface';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(PaymentEntity)
    private paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(OrderEntity)
    private orderRepository: Repository<OrderEntity>,
    private orderService: OrderService,
    @Inject('PAYMENT_PROVIDER')
    private paymentProvider: PaymentProvider,
  ) {}

  async createInvoice(userId: number, orderId: number): Promise<{ pageUrl: string }> {
    const order = await this.orderService.findOneForUser(orderId, {
      id: userId,
      roles: [{ value: 'USER' }],
    });

    if (order.paymentMethod !== 'CARD') {
      throw new BadRequestException('Замовлення не вимагає онлайн-оплати');
    }

    if (order.paymentStatus === PaymentStatus.Paid) {
      throw new BadRequestException('Замовлення вже оплачене');
    }

    if (order.paymentInvoiceId) {
      throw new BadRequestException('Інвойс для цього замовлення вже створено');
    }

    const amount = Math.round(order.total * 100);
    const baseUrl = process.env.BASE_URL;
    const frontendUrl = process.env.FRONTEND_URL;

    if (!baseUrl || !frontendUrl) {
      throw new InternalServerErrorException('BASE_URL or FRONTEND_URL not configured');
    }

    const input: CreateInvoiceInput = {
      amount,
      ccy: 980,
      webHookUrl: `${baseUrl}payment/webhook`,
      redirectUrl: `${frontendUrl}/order/${orderId}`,
      reference: String(orderId),
    };

    const { invoiceId, pageUrl } = await this.paymentProvider.createInvoice(input);

    order.paymentInvoiceId = invoiceId;
    order.paymentStatus = PaymentStatus.Pending;
    await this.orderRepository.save(order);

    const paymentLog = this.paymentRepository.create({
      orderId,
      provider: 'mono',
      invoiceId,
      amount,
      status: PaymentStatus.Pending,
      rawPayload: { amount, ccy: 980, orderId: String(orderId) },
    });
    await this.paymentRepository.save(paymentLog);

    return { pageUrl };
  }

  async refund(invoiceId: string, amount?: number): Promise<void> {
    const paymentLog = await this.paymentRepository.findOne({
      where: { invoiceId },
    });

    if (!paymentLog) {
      throw new NotFoundException('Платіж не знайдено');
    }

    if (paymentLog.status !== PaymentStatus.Paid) {
      throw new BadRequestException('Повернути кошти можна лише для оплаченого платежу');
    }

    const refundAmount = amount ?? paymentLog.amount;
    if (refundAmount > paymentLog.amount) {
      throw new BadRequestException('Сума повернення перевищує суму платежу');
    }

    await this.paymentProvider.refund({ invoiceId, amount });

    // Часткове повернення не робить платіж повністю поверненим: статус
    // лишається PAID, а повернута сума накопичується в журналі.
    if (refundAmount < paymentLog.amount) {
      const alreadyRefunded = Number(paymentLog.rawPayload?.refundedAmount) || 0;
      paymentLog.rawPayload = {
        ...paymentLog.rawPayload,
        refundedAmount: alreadyRefunded + refundAmount,
      };
      await this.paymentRepository.save(paymentLog);
      return;
    }

    paymentLog.status = PaymentStatus.Refunded;
    await this.paymentRepository.save(paymentLog);

    const order = await this.orderRepository.findOne({
      where: { id: paymentLog.orderId },
    });
    if (order) {
      order.paymentStatus = PaymentStatus.Refunded;
      await this.orderRepository.save(order);
    }
  }
}