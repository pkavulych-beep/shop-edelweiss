import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntityManager, In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { OrderEntity } from 'src/order/entities/order.entity';
import { PaymentMethod, PaymentStatus } from 'src/order/paymentEnum';
import { OrderService } from 'src/order/order.service';
import { Status } from 'src/order/statusEnum';
import { PaymentEntity, PaymentLogKind } from './entities/payment.entity';
import { isCardPaymentAvailable } from './card-payment';
import {
  CreateInvoiceInput,
  InvoiceStatusResult,
  PaymentProvider,
  VerifyWebhookInput,
  WebhookEvent,
} from './providers/payment-provider.interface';

// Скільки хвилин діє рахунок mono. За замовчуванням година (рішення #189).
const DEFAULT_PAYMENT_TIMEOUT_MINUTES = 60;

// Скільки хвилин чекаємо понад строк перед звіркою: вебхук про оплату може
// ще йти, а статус у mono — оновлюватися.
const STATUS_CHECK_GRACE_MINUTES = 5;

function paymentTimeoutMinutes(): number {
  const value = Number(process.env.PAYMENT_TIMEOUT_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_PAYMENT_TIMEOUT_MINUTES;
}

// Куди вебхук може перевести оплату з поточного стану. Чого тут немає —
// не змінює нічого: PAID → PAID, повернення в PENDING, «провал» уже оплаченого.
const ALLOWED_TRANSITIONS: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  [PaymentStatus.Pending]: [PaymentStatus.Paid, PaymentStatus.Failed],
  [PaymentStatus.Failed]: [PaymentStatus.Paid],
  [PaymentStatus.Paid]: [PaymentStatus.Refunded],
};

// Один запис журналу для адмінки. Сирий payload провайдера не віддаємо:
// лише статус mono і причину відмови, якщо вони там є.
export interface PaymentHistoryEntry {
  at: Date;
  kind: PaymentLogKind;
  status: string;
  amount: number;
  monoStatus?: string;
  failureReason?: string;
}

export interface OrderPaymentDetails {
  invoiceId: string | null;
  paidAt: Date | null;
  amount: number | null;
  refundedAmount: number;
  refundableAmount: number;
  history: PaymentHistoryEntry[];
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private reconciling = false;

  constructor(
    @InjectRepository(PaymentEntity)
    private paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(OrderEntity)
    private orderRepository: Repository<OrderEntity>,
    private orderService: OrderService,
    @Inject('PAYMENT_PROVIDER')
    private paymentProvider: PaymentProvider,
  ) {}

  // Публічний перелік доступних способів оплати: фронт за ним ховає варіант
  // «Карткою онлайн», поки еквайринг не налаштований.
  getMethods(): { card: boolean } {
    return { card: isCardPaymentAvailable() };
  }

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

    // Захист від гонки з reconcileOrdersWithoutInvoice:
    // CARD-замовлення без інвойсу, яке старше за paymentTimeoutMinutes,
    // може бути скасоване кроном у будь-який момент. Відхиляємо створення
    // інвойсу, щоб не «оживити» уже скасоване замовлення.
    const orderAgeMinutes = (Date.now() - new Date(order.createdAt).getTime()) / 60_000;
    if (
      !order.paymentInvoiceId &&
      order.paymentStatus === PaymentStatus.NotRequired &&
      orderAgeMinutes > paymentTimeoutMinutes()
    ) {
      throw new BadRequestException('Час на оплату минув');
    }

    // Те саме для повторної оплати після FAILED: коли строк поточного рахунку
    // минув, замовлення скасовує reconcileFailedOrders.
    if (order.paymentInvoiceId && order.paymentStatus === PaymentStatus.Failed) {
      const failedLog = await this.paymentRepository.findOne({
        where: { invoiceId: order.paymentInvoiceId, kind: PaymentLogKind.Invoice },
      });
      const invoiceAgeMinutes = failedLog
        ? (Date.now() - new Date(failedLog.createdAt).getTime()) / 60_000
        : 0;
      if (invoiceAgeMinutes > paymentTimeoutMinutes()) {
        throw new BadRequestException('Час на оплату минув');
      }
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
      // ведемо на сторінку результату оплати з orderId, щоб вона могла прочитати
      // статус з беку.
      redirectUrl: `${frontendUrl}payment/success?orderId=${orderId}`,
      reference: String(orderId),
      // validity — у секундах: стільки рахунок можна оплатити.
      validity: paymentTimeoutMinutes() * 60,
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

  // Деталі оплати для адмінки: рахунок, час оплати, повернення й журнал подій.
  // Замовлення без рахунку (COD або інвойс ще не створювали) — не помилка.
  async getOrderPayment(orderId: number): Promise<OrderPaymentDetails> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Замовлення не знайдено');
    }

    const invoiceLog = order.paymentInvoiceId
      ? await this.paymentRepository.findOne({
          where: {
            invoiceId: order.paymentInvoiceId,
            kind: PaymentLogKind.Invoice,
          },
        })
      : null;

    // Історія — усі записи журналу замовлення, від старих до нових.
    const logs = await this.paymentRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    const amount = invoiceLog ? invoiceLog.amount : null;
    const refundedAmount = Number(invoiceLog?.rawPayload?.refundedAmount) || 0;

    return {
      invoiceId: order.paymentInvoiceId ?? null,
      paidAt: order.paidAt ?? null,
      amount,
      refundedAmount,
      refundableAmount: amount === null ? 0 : Math.max(amount - refundedAmount, 0),
      history: logs.map((log) => this.toHistoryEntry(log)),
    };
  }

  private toHistoryEntry(log: PaymentEntity): PaymentHistoryEntry {
    const raw = log.rawPayload ?? {};
    const entry: PaymentHistoryEntry = {
      at: log.createdAt,
      kind: log.kind,
      status: log.status,
      amount: log.amount,
    };

    if (typeof raw.status === 'string' && raw.status) {
      entry.monoStatus = raw.status;
    }
    if (typeof raw.failureReason === 'string' && raw.failureReason) {
      entry.failureReason = raw.failureReason;
    }

    return entry;
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

  // Mono не надсилає вебхук для `expired`, тож неоплачені CARD-замовлення
  // самі не скасовуються. Раз на 5 хвилин перевіряємо лише ті інвойси, строк
  // яких уже минув (плюс запас), і один раз питаємо статус у mono.
  // Явна назва: без неї @nestjs/schedule бере globalThis.crypto.randomUUID(),
  // а в Jest (e2e) global crypto недоступний і застосунок не стартує.
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'reconcile-pending-card-payments' })
  async reconcilePendingCardPayments(): Promise<void> {
    // Попередній прохід ще не завершився: не дублюємо запити.
    if (this.reconciling) {
      return;
    }
    this.reconciling = true;

    try {
      const cutoff = new Date(
        Date.now() - (paymentTimeoutMinutes() + STATUS_CHECK_GRACE_MINUTES) * 60_000,
      );

      // 1. Звірка інвойсів, що мають запис у payment (як і раніше).
      //    Потрібен MONO_ACQUIRING_TOKEN.
      if (process.env.MONO_ACQUIRING_TOKEN) {
        const invoiceLogs = await this.paymentRepository.find({
          where: {
            kind: PaymentLogKind.Invoice,
            status: PaymentStatus.Pending,
            createdAt: LessThanOrEqual(cutoff),
          },
        });

        for (const invoiceLog of invoiceLogs) {
          try {
            await this.reconcileInvoice(invoiceLog);
          } catch (error) {
            this.logger.warn(
              `Не вдалося перевірити статус інвойсу ${invoiceLog.invoiceId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }

      // 2. Звірка CARD-замовлень БЕЗ інвойсу (paymentInvoiceId порожній,
      //    paymentStatus = NOT_REQUIRED). mono не потрібен.
      await this.reconcileOrdersWithoutInvoice(cutoff);

      // 3. CARD-замовлення, оплата яких не пройшла (FAILED після вебхука
      //    failure), а покупець не повторив її до кінця строку рахунку.
      //    mono не потрібен.
      await this.reconcileFailedOrders(cutoff);
    } finally {
      this.reconciling = false;
    }
  }

  private async reconcileOrdersWithoutInvoice(cutoff: Date): Promise<void> {
    const orders = await this.orderRepository.find({
      where: {
        paymentMethod: PaymentMethod.Card,
        paymentInvoiceId: IsNull(),
        paymentStatus: PaymentStatus.NotRequired,
        status: Status.Processed,
        createdAt: LessThanOrEqual(cutoff),
      },
    });

    for (const order of orders) {
      try {
        await this.cancelOrderWithoutInvoice(order);
      } catch (error) {
        this.logger.warn(
          `Не вдалося скасувати замовлення ${order.id} без інвойсу: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async cancelOrderWithoutInvoice(order: OrderEntity): Promise<void> {
    await this.paymentRepository.manager.transaction(async (manager) => {
      const cancelled = await this.orderService.cancelOrderWithoutInvoice(manager, order.id);
      if (!cancelled) {
        return;
      }

      // Журнал: статус-перевірка, як у reconcileInvoice.
      await manager.save(
        PaymentEntity,
        manager.create(PaymentEntity, {
          orderId: order.id,
          provider: 'mono',
          invoiceId: '',
          kind: PaymentLogKind.StatusCheck,
          amount: Math.round(order.total * 100),
          status: PaymentStatus.Failed,
          providerModifiedAt: new Date(),
          rawPayload: { status: 'no_invoice', reason: 'invoice_creation_failed' },
        }),
      );
    });
  }

  private async reconcileFailedOrders(cutoff: Date): Promise<void> {
    // Інвойс створюють після замовлення, тож замовлення, молодше за cutoff,
    // не може мати простроченого рахунку.
    const orders = await this.orderRepository.find({
      where: {
        paymentMethod: PaymentMethod.Card,
        paymentInvoiceId: Not(IsNull()),
        paymentStatus: PaymentStatus.Failed,
        status: Status.Processed,
        createdAt: LessThanOrEqual(cutoff),
      },
    });
    if (!orders.length) {
      return;
    }

    // Строк рахуємо від поточного інвойсу: після повторної спроби покупець
    // має на оплату весь строк нового рахунку.
    const expiredInvoiceLogs = await this.paymentRepository.find({
      where: {
        kind: PaymentLogKind.Invoice,
        invoiceId: In(orders.map((order) => order.paymentInvoiceId)),
        createdAt: LessThanOrEqual(cutoff),
      },
    });
    const expiredLogByInvoice = new Map(
      expiredInvoiceLogs.map((invoiceLog) => [invoiceLog.invoiceId, invoiceLog]),
    );

    for (const order of orders) {
      const invoiceLog = expiredLogByInvoice.get(order.paymentInvoiceId);
      if (!invoiceLog || invoiceLog.orderId !== order.id) {
        continue;
      }

      try {
        await this.cancelFailedOrder(invoiceLog);
      } catch (error) {
        this.logger.warn(
          `Не вдалося скасувати замовлення ${order.id} з неуспішною оплатою: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async cancelFailedOrder(invoiceLog: PaymentEntity): Promise<void> {
    await this.paymentRepository.manager.transaction(async (manager) => {
      const cancelled = await this.orderService.cancelFailedOrder(
        manager,
        invoiceLog.orderId,
        invoiceLog.invoiceId,
      );
      if (!cancelled) {
        return;
      }

      // Журнал: причина скасування для адмінки. Строк рахунку минув, а нового
      // покупець не створив.
      await manager.save(
        PaymentEntity,
        manager.create(PaymentEntity, {
          orderId: invoiceLog.orderId,
          provider: invoiceLog.provider,
          invoiceId: invoiceLog.invoiceId,
          kind: PaymentLogKind.StatusCheck,
          amount: invoiceLog.amount,
          status: PaymentStatus.Failed,
          providerModifiedAt: new Date(),
          rawPayload: { status: 'expired', reason: 'payment_failed' },
        }),
      );
    });
  }

  private async reconcileInvoice(invoiceLog: PaymentEntity): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: invoiceLog.orderId },
    });
    if (!this.isAwaitingPayment(order, invoiceLog.invoiceId)) {
      return;
    }

    const status = await this.paymentProvider.getInvoiceStatus(invoiceLog.invoiceId);

    switch (status.status) {
      case 'success':
        await this.applyInvoiceStatusPaid(invoiceLog, status);
        return;
      case 'expired':
      case 'failure':
        await this.applyInvoiceStatusFailed(invoiceLog, status);
        return;
      case 'created':
        // Рахунок ще не оплачували: спершу робимо його неоплачуваним, щоб
        // покупець не оплатив його після скасування, а вже тоді скасовуємо.
        await this.paymentProvider.invalidateInvoice(invoiceLog.invoiceId);
        await this.applyInvoiceStatusFailed(invoiceLog, status);
        return;
      default:
        // processing (і hold): платіж ще обробляється — перевіримо наступного разу.
        return;
    }
  }

  private isAwaitingPayment(order: OrderEntity | null, invoiceId: string): boolean {
    return (
      !!order &&
      order.paymentMethod === PaymentMethod.Card &&
      order.paymentStatus === PaymentStatus.Pending &&
      order.paymentInvoiceId === invoiceId &&
      order.status !== Status.Canceled
    );
  }

  private async applyInvoiceStatusPaid(
    invoiceLog: PaymentEntity,
    status: InvoiceStatusResult,
  ): Promise<void> {
    await this.paymentRepository.manager.transaction(async (manager) => {
      const lockedLog = await manager.findOne(PaymentEntity, {
        where: { id: invoiceLog.id },
        lock: { mode: 'pessimistic_write' },
      });
      // Поки ходили в mono, вебхук уже міг застосувати оплату.
      if (!lockedLog || lockedLog.status !== PaymentStatus.Pending) {
        return;
      }

      // Як і у вебхуку, не зараховуємо оплату з іншою сумою чи валютою.
      if (status.amount !== lockedLog.amount || status.ccy !== 980) {
        this.logger.error(
          `Сума оплати інвойсу ${lockedLog.invoiceId} (${status.amount}/${status.ccy}) ` +
            `не збігається з інвойсом (${lockedLog.amount}/980)`,
        );
        return;
      }

      const order = await manager.findOne(OrderEntity, {
        where: { id: lockedLog.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!this.isAwaitingPayment(order, lockedLog.invoiceId)) {
        return;
      }

      const paidAt = this.statusModifiedDate(status) ?? new Date();
      await this.writeStatusLog(manager, lockedLog, PaymentStatus.Paid, paidAt, status);

      lockedLog.status = PaymentStatus.Paid;
      lockedLog.providerModifiedAt = paidAt;
      await manager.save(PaymentEntity, lockedLog);

      order.paymentStatus = PaymentStatus.Paid;
      order.paidAt = paidAt;
      await manager.save(OrderEntity, order);
    });
  }

  private async applyInvoiceStatusFailed(
    invoiceLog: PaymentEntity,
    status: InvoiceStatusResult,
  ): Promise<void> {
    await this.paymentRepository.manager.transaction(async (manager) => {
      const lockedLog = await manager.findOne(PaymentEntity, {
        where: { id: invoiceLog.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedLog || lockedLog.status !== PaymentStatus.Pending) {
        return;
      }

      const order = await manager.findOne(OrderEntity, {
        where: { id: lockedLog.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!this.isAwaitingPayment(order, lockedLog.invoiceId)) {
        return;
      }

      const modifiedAt = this.statusModifiedDate(status) ?? new Date();
      await this.writeStatusLog(manager, lockedLog, PaymentStatus.Failed, modifiedAt, status);

      await this.orderService.cancelUnpaidOrder(
        manager,
        lockedLog.orderId,
        lockedLog.invoiceId,
      );

      lockedLog.status = PaymentStatus.Failed;
      lockedLog.providerModifiedAt = modifiedAt;
      await manager.save(PaymentEntity, lockedLog);
    });
  }

  private async writeStatusLog(
    manager: EntityManager,
    invoiceLog: PaymentEntity,
    status: PaymentStatus,
    modifiedAt: Date,
    raw: InvoiceStatusResult,
  ): Promise<void> {
    await manager.save(
      PaymentEntity,
      manager.create(PaymentEntity, {
        orderId: invoiceLog.orderId,
        provider: invoiceLog.provider,
        invoiceId: invoiceLog.invoiceId,
        kind: PaymentLogKind.StatusCheck,
        amount: typeof raw.amount === 'number' ? raw.amount : invoiceLog.amount,
        status,
        providerModifiedAt: modifiedAt,
        rawPayload: raw,
      }),
    );
  }

  private statusModifiedDate(status: InvoiceStatusResult): Date | null {
    if (typeof status.modifiedDate !== 'string') {
      return null;
    }
    const date = new Date(status.modifiedDate);
    return Number.isNaN(date.getTime()) ? null : date;
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
