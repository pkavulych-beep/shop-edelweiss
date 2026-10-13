import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

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

  @Column({ type: 'int' })
  amount: number;

  @Column()
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}