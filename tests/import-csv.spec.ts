import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { AiService } from '../src/ai/ai.service.js';
import type { Product } from '../src/database/entities/product.entity.js';
import { ProductsService } from '../src/products/products.service.js';

describe('ProductsService.importFromCsv', () => {
  it('keeps explicit categories from CSV even if they are new', async () => {
    const findOne = vi.fn<Repository<Product>['findOne']>().mockResolvedValue(null);
    const create = vi
      .fn<Repository<Product>['create']>()
      .mockImplementation((payload: Partial<Product>) => payload as Product);
    const save = vi
      .fn<Repository<Product>['save']>()
      .mockImplementation(async (entity: Product) => ({ ...entity, id: 1 } as Product));

    const repository = { findOne, create, save } as unknown as Repository<Product>;
    const getRepository = vi.fn<DataSource['getRepository']>().mockReturnValue(repository);
    const dataSource = { getRepository } as unknown as DataSource;

    const inferCategory = vi.fn<AiService['inferCategory']>();
    const aiService = {
      inferCategory,
      generateSummary: vi.fn(),
      translateProductContent: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(false),
    } as unknown as AiService;

    const service = new ProductsService(dataSource, aiService);
    vi.spyOn(service as unknown as { getExistingCategories: () => Promise<string[]> }, 'getExistingCategories')
      .mockResolvedValue(['electronics']);

    const csv = [
      'extId,title,description,price,category,image',
      '123,Test Product,A product for testing,19.99,New Category,https://example.com/image.jpg',
    ].join('\n');

    const summary = await service.importFromCsv(Buffer.from(`${csv}\n`, 'utf8'));

    expect(summary).toEqual({ created: 1, updated: 0, errors: [] });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ category: 'New Category' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ category: 'New Category' }));
    expect(inferCategory).not.toHaveBeenCalled();
  });
});
