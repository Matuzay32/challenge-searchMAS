import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Product } from '../database/entities/product.entity.js';

const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [Product],
  synchronize: NODE_ENV !== 'production',
  logging: NODE_ENV === 'development',
});

export async function initializeDataSource(): Promise<DataSource> {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  return AppDataSource.initialize();
}
