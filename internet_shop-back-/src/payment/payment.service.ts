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
import { Status } from 'src/order/statusEnum';
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

    if (order.status === Status.Canceled) {
      throw new BadRequestException('Замовлення скасовано, оплата неможлива');
    }

    if (order.paymentMethod !== 'CARD') {
      throw new BadRequestException('Замовлення не вимагає онлайн-оплати');
    }

    if (order.paymentStatus === PaymentStatus.Paid) {
      throw new BadRequestException('Замовлення вже оплачене');
    }

    if (order.paymentInvoiceId) {
      // Повторний запит, поки інвойс ще PENDING, не створює новий, а повертає
      // той самий pageUrl: покупець, який закрив сторінку оплати, може
      // спробувати ще раз. Новий інвойс після FAILED/строку — у #192.
      const existingLog = await this.paymentRepository.findOne({
        where: { invoiceId: order.paymentInvoiceId },
      });
      const existingPageUrl = existingLog?.rawPayload?.pageUrl;

      if (
        order.paymentStatus === PaymentStatus.Pending &&
        typeof existingPageUrl === 'string'
      ) {
        return { pageUrl: existingPageUrl };
      }

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
      // FRONTEND_URL, як і BASE_URL, закінчується слешем: без подвійного слеша
      // ведемо на наявну сторінку зі списком замовлень.
      redirectUrl: `${frontendUrl}orders`,
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
      rawPayload: { amount, ccy: 980, orderId: String(orderId), pageUrl },
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

    if (paymentLog.status === PaymentStatus.Refunded) {
      throw new BadRequestException('Платіж уже повністю повернуто');
    }

    if (paymentLog.status !== PaymentStatus.Paid) {
      throw new BadRequestException('Повернути кошти можна лише для оплаченого платежу');
    }

    // Повернення враховують те, що вже повернуто: два часткові по 50% разом
    // дають повне повернення, а не тихо «з'їдають» більше за оплату.
    const alreadyRefunded = Number(paymentLog.rawPayload?.refundedAmount) || 0;
    const remaining = paymentLog.amount - alreadyRefunded;
    // Повне повернення (amount не задано) повертає лише залишок, а не всю суму.
    const refundAmount = amount ?? remaining;

    if (refundAmount > remaining) {
      throw new BadRequestException('Сума повернення перевищує залишок платежу');
    }

    await this.paymentProvider.refund({ invoiceId, amount: refundAmount });

    const totalRefunded = alreadyRefunded + refundAmount;
    const fullyRefunded = totalRefunded >= paymentLog.amount;

    paymentLog.rawPayload = {
      ...paymentLog.rawPayload,
      refundedAmount: totalRefunded,
    };
    if (fullyRefunded) {
      paymentLog.status = PaymentStatus.Refunded;
    }
    await this.paymentRepository.save(paymentLog);

    if (fullyRefunded) {
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