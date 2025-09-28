import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { createProductsRouter } from './products/products.router.js';
import { createAiRouter } from './ai/ai.router.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { ProductsService } from './products/products.service.js';
import { AiService } from './ai/ai.service.js';

export interface AppDependencies {
  productsService: ProductsService;
  aiService: AiService;
}

export function createApp({ productsService, aiService }: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', createProductsRouter(productsService));
  app.use('/api', createAiRouter(aiService));

  app.use((req, res) => {
    res.status(404).json({ status: 404, message: `Route ${req.originalUrl} not found` });
  });

  app.use(errorHandler);

  return app;
}
