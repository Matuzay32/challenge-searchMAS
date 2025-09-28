import 'dotenv/config';
import 'reflect-metadata';
import { createApp } from './app.js';
import { initializeDataSource } from './config/data-source.js';

const port = Number(process.env.PORT ?? 3000);

async function bootstrap(): Promise<void> {
  try {
    await initializeDataSource();
    const app = createApp();

    app.listen(port, () => {
      console.log(`🚀 API is running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start application', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

void bootstrap();
