import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OrderEntity } from 'src/order/entities/order.entity';
import { PaymentStatus } from 'src/order/paymentEnum';
import { OrderService } from 'src/order/order.service';
import { Status } from 'src/order/statusEnum';
import { PaymentEntity, PaymentLogKind } from './entities/payment.entity';
import {
  CreateInvoiceInput,
  PaymentProvider,
  VerifyWebhookInput,
  WebhookEvent,
} from './providers/payment-provider.interface';

// Куди вебхук може перевести оплату з поточного стану. Чого тут немає —
// не змінює нічого: PAID → PAID, повернення в PENDING, «провал» уже оплаченого.
const ALLOWED_TRANSITIONS: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  [PaymentStatus.Pending]: [PaymentStatus.Paid, PaymentStatus.Failed],
  [PaymentStatus.Failed]: [PaymentStatus.Paid],
  [PaymentStatus.Paid]: [PaymentStatus.Refunded],
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

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

    // Після FAILED (відмова чи прострочений інвойс) покупець може спробувати
    // ще раз: створюється новий інвойс, і замовлення переходить на нього.
    if (order.paymentInvoiceId && order.paymentStatus !== PaymentStatus.Failed) {
      // Повторний запит, поки інвойс ще PENDING, не створює новий, а повертає
      // той самий pageUrl: покупець, який закрив сторінку оплати, може
      // спробувати ще раз.
      const existingLog = await this.paymentRepository.findOne({
        where: { invoiceId: order.paymentInvoiceId, kind: PaymentLogKind.Invoice },
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
      webHookUrl: `${baseUrl}payment/webhook/mono`,
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
      kind: PaymentLogKind.Invoice,
      amount,
      status: PaymentStatus.Pending,
      rawPayload: { amount, ccy: 980, orderId: String(orderId), pageUrl },
    });
    await this.paymentRepository.save(paymentLog);

    return { pageUrl };
  }

  async refund(invoiceId: string, amount?: number): Promise<void> {
    const paymentLog = await this.paymentRepository.findOne({
      where: { invoiceId, kind: PaymentLogKind.Invoice },
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

  // Єдиний шлях, яким замовлення стає оплаченим. Підпис перевіряє провайдер
  // (400 без змін у базі), далі все — в одній транзакції з блокуванням
  // інвойсу, щоб паралельні повтори одного вебхука не застосувались двічі.
  async handleWebhook(input: VerifyWebhookInput): Promise<void> {
    const event = await this.paymentProvider.verifyWebhook(input);

    await this.paymentRepository.manager.transaction((manager) =>
      this.applyWebhook(manager, event),
    );
  }

  private async applyWebhook(manager: EntityManager, event: WebhookEvent): Promise<void> {
    const invoiceLog = await manager.findOne(PaymentEntity, {
      where: { invoiceId: event.invoiceId, kind: PaymentLogKind.Invoice },
      lock: { mode: 'pessimistic_write' },
    });

    if (!invoiceLog) {
      // Підпис справжній, але інвойс не наш (інше середовище з тим самим
      // токеном): прив'язати запис до замовлення нема до чого.
      this.logger.warn(`Вебхук для невідомого інвойсу ${event.invoiceId}`);
      return;
    }

    // Журнал: кожен перевірений вебхук разом із payload, навіть повтор.
    await manager.save(
      PaymentEntity,
      manager.create(PaymentEntity, {
        orderId: invoiceLog.orderId,
        provider: invoiceLog.provider,
        invoiceId: event.invoiceId,
        kind: PaymentLogKind.Webhook,
        amount: event.amount,
        status: event.status,
        providerModifiedAt: event.modifiedDate,
        rawPayload: event.payload,
      }),
    );

    // Ключ ідемпотентності — (invoiceId, modifiedDate): повтор або вебхук, що
    // прийшов не в тому порядку, вже нічого не змінює.
    if (
      invoiceLog.providerModifiedAt &&
      event.modifiedDate.getTime() <= new Date(invoiceLog.providerModifiedAt).getTime()
    ) {
      return;
    }
    invoiceLog.providerModifiedAt = event.modifiedDate;

    const current = invoiceLog.status as PaymentStatus;
    let next: PaymentStatus | null = ALLOWED_TRANSITIONS[current]?.includes(event.status)
      ? event.status
      : null;

    if (
      next === PaymentStatus.Paid &&
      (event.amount !== invoiceLog.amount || event.ccy !== 980)
    ) {
      this.logger.error(
        `Сума оплати інвойсу ${event.invoiceId} (${event.amount}/${event.ccy}) ` +
          `не збігається з інвойсом (${invoiceLog.amount}/980)`,
      );
      next = null;
    }

    if (next) {
      invoiceLog.status = next;
    }
    await manager.save(PaymentEntity, invoiceLog);

    if (!next) {
      return;
    }

    const order = await manager.findOne(OrderEntity, {
      where: { id: invoiceLog.orderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) {
      this.logger.warn(`Замовлення ${invoiceLog.orderId} для інвойсу ${event.invoiceId} не знайдено`);
      return;
    }
    // Старий інвойс (замовлення вже перейшло на новий після FAILED) змінює
    // лише свій запис, але не стан замовлення.
    if (order.paymentInvoiceId !== event.invoiceId) {
      this.logger.warn(
        `Вебхук інвойсу ${event.invoiceId}, а замовлення ${order.id} вже на ${order.paymentInvoiceId}`,
      );
      return;
    }

    order.paymentStatus = next;
    if (next === PaymentStatus.Paid) {
      order.paidAt = event.modifiedDate;
    }
    await manager.save(OrderEntity, order);
  }
}
