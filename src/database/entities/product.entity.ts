import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'products' })
@Index('idx_products_ext_id_unique', ['extId'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  extId!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price!: string;

  @Column({ type: 'varchar', length: 255 })
  category!: string;

  @Column({ type: 'text' })
  image!: string;

  @Column({ type: 'text', nullable: true })
  aiSummary!: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
