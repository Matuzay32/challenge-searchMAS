import 'dotenv/config';
import 'reflect-metadata';
import { initializeDataSource, AppDataSource } from '../config/data-source.js';
import { AiService } from '../ai/ai.service.js';
import { ProductsService } from '../products/products.service.js';

async function seed() {
  try {
    await initializeDataSource();
    const aiService = new AiService();
    const productsService = new ProductsService(AppDataSource, aiService);
    const products = await productsService.syncExternalData();

    // eslint-disable-next-line no-console
    console.log(`Seed completed with ${products.length} products`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Seed failed', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void seed();
