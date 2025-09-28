import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { PaginatedProducts, ProductsService } from '../src/products/products.service.js';
import type { AiService } from '../src/ai/ai.service.js';
import { GetProductsQueryDto } from '../src/products/dto/get-products.dto.js';

describe('GET /api/data', () => {
  it('returns paginated products with metadata', async () => {
    const mockProducts: PaginatedProducts = {
      data: [
        {
          id: 1,
          extId: 101,
          title: 'Test Product',
          description: 'A product used for testing purposes',
          price: 19.99,
          category: 'test-category',
          image: 'https://example.com/product.jpg',
          aiSummary: 'Resumen de prueba',
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: {
        page: 1,
        size: 10,
        total: 1,
        totalPages: 1,
      },
      stats: {
        byCategory: {
          'test-category': 1,
        },
      },
    };

    const productsService: Partial<ProductsService> = {
      getProducts: vi.fn().mockResolvedValue(mockProducts),
      syncExternalData: vi.fn(),
      exportAsCsv: vi.fn(),
    };

    const aiService: Partial<AiService> = {
      generateSummary: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(true),
    };

    const app = createApp({
      productsService: productsService as ProductsService,
      aiService: aiService as AiService,
    });

    const response = await request(app).get('/api/data');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.stats.byCategory['test-category']).toBe(1);
    const getProductsSpy = productsService.getProducts as ReturnType<typeof vi.fn>;
    expect(getProductsSpy).toHaveBeenCalledWith(expect.any(GetProductsQueryDto));
  });
});
