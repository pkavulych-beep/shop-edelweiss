import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// У таблиці payment два види записів: один «інвойс» на кожен створений
// інвойс (поточний стан оплати) і журнал усіх перевірених вебхуків до нього.
export enum PaymentLogKind {
  Invoice = 'invoice',
  Webhook = 'webhook',
}

@Entity('payment')
export class PaymentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @Column()
  provider: string;

  @Column()
  invoiceId: string;

  @Column({ default: PaymentLogKind.Invoice })
  kind: PaymentLogKind;

  @Column({ type: 'int' })
  amount: number;

  @Column()
  status: string;

  // modifiedDate від провайдера: в інвойсі — останнього застосованого вебхука,
  // у записі журналу — цього вебхука. Старіші вебхуки ігноруються.
  @Column({ type: 'timestamptz', nullable: true })
  providerModifiedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
