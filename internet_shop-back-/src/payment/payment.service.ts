import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { OrderEntity } from 'src/order/entities/order.entity';
import { PaymentStatus } from 'src/order/paymentEnum';
import { OrderService } from 'src/order/order.service';
import { PaymentEntity } from './entities/payment.entity';
import {
  CreateInvoiceInput,
  PaymentProvider,
  VerifyWebhookOutput,
} from './providers/payment-provider.interface';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(PaymentEntity)
    private paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(OrderEntity)
    private orderRepository: Repository<OrderEntity>,
    private orderService: OrderService,
    private configService: ConfigService,
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
    const baseUrl = this.configService.get<string>('BASE_URL');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    if (!baseUrl || !frontendUrl) {
      throw new InternalServerErrorException('BASE_URL or FRONTEND_URL not configured');
    }

    const input: CreateInvoiceInput = {
      amount,
      ccy: 980,
      orderId: String(orderId),
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

  async handleWebhook(
    body: Record<string, unknown>,
    signature: string,
  ): Promise<VerifyWebhookOutput> {
    const result = this.paymentProvider.verifyWebhook({ body, signature });

    const order = await this.orderRepository.findOne({
      where: { id: Number(result.orderId) },
    });

    if (!order) {
      throw new NotFoundException(`Order ${result.orderId} not found`);
    }

    if (order.paymentInvoiceId !== result.invoiceId) {
      throw new BadRequestException('Invoice ID mismatch');
    }

    const paymentLog = await this.paymentRepository.findOne({
      where: { invoiceId: result.invoiceId },
    });

    if (paymentLog) {
      paymentLog.status = result.status;
      paymentLog.rawPayload = { ...paymentLog.rawPayload, ...body };
      await this.paymentRepository.save(paymentLog);
    }

    if (result.status === 'success' || result.status === 'approved') {
      order.paymentStatus = PaymentStatus.Paid;
      order.paidAt = new Date();
      await this.orderRepository.save(order);
    } else if (result.status === 'failure' || result.status === 'reversed') {
      order.paymentStatus = PaymentStatus.Failed;
      await this.orderRepository.save(order);
    }

    return result;
  }

  async refund(invoiceId: string, amount?: number): Promise<void> {
    const paymentLog = await this.paymentRepository.findOne({
      where: { invoiceId },
    });

    if (!paymentLog) {
      throw new NotFoundException('Payment log not found');
    }

    await this.paymentProvider.refund({ invoiceId, amount });

    if (amount && amount < paymentLog.amount) {
      paymentLog.status = PaymentStatus.Refunded;
      await this.paymentRepository.save(paymentLog);
    } else {
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
}