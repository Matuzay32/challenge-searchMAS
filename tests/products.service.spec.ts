import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { AiService } from '../src/ai/ai.service.js';
import type { Product } from '../src/database/entities/product.entity.js';
import { ProductsService } from '../src/products/products.service.js';
import { AppError } from '../src/utils/httpError.js';

type MutableProduct = Product & { createdAt: Date };

type MockRepository = Repository<Product> & {
  __setQueryBuilders: (...builders: Array<SelectQueryBuilder<Product>>) => void;
};

function createProduct(overrides: Partial<Product> = {}): MutableProduct {
  const createdAt = overrides.createdAt instanceof Date ? overrides.createdAt : new Date();
  return {
    id: overrides.id ?? 1,
    extId: overrides.extId ?? 100,
    title: overrides.title ?? 'Sample Product',
    description: overrides.description ?? 'Description',
    price: overrides.price ?? '10.00',
    category: overrides.category ?? 'electronics',
    image: overrides.image ?? 'https://example.com/image.jpg',
    aiSummary: overrides.aiSummary ?? null,
    createdAt,
  } as MutableProduct;
}

function createQueryBuilderMock(options: {
  entities?: Product[];
  total?: number;
  stats?: Array<{ category: string; count: string }>;
} = {}) {
  const {
    entities = [createProduct()],
    total = entities.length,
    stats = [{ category: 'electronics', count: String(entities.length) }],
  } = options;

  const qb: Partial<SelectQueryBuilder<Product>> = {
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([entities, total]),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(stats),
    getMany: vi.fn().mockResolvedValue(entities),
  };

  return qb as SelectQueryBuilder<Product>;
}

function createService({
  repositoryOverrides = {},
  aiOverrides = {},
}: {
  repositoryOverrides?: Partial<Repository<Product>>;
  aiOverrides?: Partial<AiService>;
} = {}) {
  const queryBuilders: Array<SelectQueryBuilder<Product>> = [];

  const repository: Partial<Repository<Product>> & {
    __setQueryBuilders?: (...builders: Array<SelectQueryBuilder<Product>>) => void;
  } = {
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    upsert: vi.fn(),
    find: vi.fn(),
    exist: vi.fn().mockResolvedValue(false),
    createQueryBuilder: vi.fn().mockImplementation(() => {
      if (queryBuilders.length === 0) {
        return createQueryBuilderMock();
      }

      return queryBuilders.shift()!;
    }),
    ...repositoryOverrides,
  };

  (repository as MockRepository).__setQueryBuilders = (...builders: Array<SelectQueryBuilder<Product>>) => {
    queryBuilders.splice(0, queryBuilders.length, ...builders);
  };

  const dataSource = {
    getRepository: vi.fn().mockReturnValue(repository),
  } as unknown as DataSource;

  const aiService: Partial<AiService> = {
    generateSummary: vi.fn(),
    isConfigured: vi.fn().mockReturnValue(true),
    translateProductContent: vi.fn(),
    inferCategory: vi.fn(),
    ...aiOverrides,
  };

  const service = new ProductsService(dataSource, aiService as AiService);

  return {
    service,
    repository: repository as MockRepository,
    aiService: aiService as AiService,
  };
}

describe('ProductsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('syncExternalData', () => {
    it('fetches products and generates summaries up to the provided limit', async () => {
      const now = new Date();
      const first = createProduct({ id: 1, extId: 101, aiSummary: 'Summary 1', createdAt: now });
      const second = createProduct({ id: 2, extId: 102, aiSummary: null, createdAt: now });

      const { service, repository, aiService } = createService({
        repositoryOverrides: {
          upsert: vi.fn().mockResolvedValue(undefined),
          find: vi.fn().mockResolvedValue([first, second]),
        },
      });

      (aiService.generateSummary as ReturnType<typeof vi.fn>).mockResolvedValue('AI Summary');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
        json: async () => [
          {
            id: 101,
            title: 'Product 101',
            description: 'Description 101',
            price: 11.5,
            category: 'gadgets',
            image: 'img-101',
          },
          {
            id: 102,
            title: 'Product 102',
            description: 'Description 102',
            price: 12.5,
            category: 'gadgets',
            image: 'img-102',
          },
        ],
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = fetchMock as typeof fetch;

      try {
        const result = await service.syncExternalData(1);

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('fakestoreapi.com/products'));
        expect(aiService.generateSummary).toHaveBeenCalledTimes(1);
        expect(repository.upsert).toHaveBeenCalledWith(expect.any(Array), ['extId']);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          id: 1,
          extId: 101,
          title: first.title,
          description: first.description,
          price: Number(first.price),
          category: first.category,
          image: first.image,
          aiSummary: first.aiSummary,
          createdAt: first.createdAt.toISOString(),
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws an AppError when the external API request fails', async () => {
      const { service } = createService();
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, statusText: 'Timeout' }) as typeof fetch;

      await expect(service.syncExternalData()).rejects.toMatchObject({
        statusCode: 502,
        message: 'Failed to fetch external data: Timeout',
      });

      globalThis.fetch = originalFetch;
    });
  });

  describe('getProducts', () => {
    it('throws when priceMin is greater than priceMax', async () => {
      const { service } = createService();

      await expect(
        service.getProducts({
          page: 1,
          size: 10,
          priceMin: 100,
          priceMax: 50,
        } as any),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('returns paginated data with stats', async () => {
      const mainQb = createQueryBuilderMock({
        entities: [createProduct({ id: 1, extId: 1 })],
        total: 1,
      });
      const statsQb = createQueryBuilderMock({
        stats: [{ category: 'electronics', count: '1' }],
      });

      const { service, repository } = createService();
      repository.__setQueryBuilders(mainQb, statsQb);

      const result = await service.getProducts({ page: 1, size: 10 } as any);

      expect(result.pagination.total).toBe(1);
      expect(mainQb.skip).toHaveBeenCalledWith(0);
      expect(mainQb.orderBy).toHaveBeenCalledWith('product.id', 'ASC');
      expect(result.stats.byCategory).toEqual({ electronics: 1 });
    });
  });

  describe('exportAsCsv', () => {
    it('generates a CSV with normalized fields', async () => {
      const entity = createProduct({ id: 5, extId: 999, price: '42.00', aiSummary: 'Resumen' });
      const qb = createQueryBuilderMock({ entities: [entity] });

      const { service, repository } = createService();
      repository.__setQueryBuilders(qb);

      const csv = await service.exportAsCsv();
      expect(csv).toContain('"id","extId","title","description","price","category","image","aiSummary","createdAt"');
      expect(csv).toContain('5,999,"Sample Product","Description",42,"electronics","https://example.com/image.jpg","Resumen"');
    });
  });

  describe('createProduct', () => {
    it('creates a product generating a unique extId when missing', async () => {
      const { service, repository, aiService } = createService({
        repositoryOverrides: {
          create: vi.fn().mockImplementation((payload: Partial<Product>) => ({
            ...payload,
            createdAt: new Date(),
          })),
          save: vi.fn().mockImplementation(async (entity: Partial<Product>) => ({
            ...(entity as Product),
            id: 10,
            createdAt: new Date(),
          })),
        },
      });

      vi.spyOn(service as unknown as { getExistingCategories: () => Promise<string[]> }, 'getExistingCategories')
        .mockResolvedValue(['electronics']);
      (aiService.inferCategory as ReturnType<typeof vi.fn>).mockResolvedValue('electronics');

      const product = await service.createProduct({
        title: 'Camera',
        description: 'Digital camera',
        price: 100.5,
        image: 'https://example.com/camera.jpg',
      } as any);

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ price: '100.50' }));
      expect(product.extId).toBeDefined();
      expect(product.price).toBe(100.5);
      expect(aiService.inferCategory).toHaveBeenCalled();
    });

    it('throws a conflict error when extId already exists', async () => {
      const { service, repository } = createService({
        repositoryOverrides: {
          create: vi.fn().mockImplementation((payload: Partial<Product>) => payload),
          save: vi.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint')),
        },
      });

      vi.spyOn(service as unknown as { getExistingCategories: () => Promise<string[]> }, 'getExistingCategories')
        .mockResolvedValue(['electronics']);

      await expect(
        service.createProduct({
          extId: 100,
          title: 'Duplicate',
          description: 'Duplicated product',
          price: 10,
          category: 'electronics',
          image: 'img',
        } as any),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('update and delete operations', () => {
    it('throws when updating without any fields', async () => {
      const entity = createProduct();
      const { service, repository } = createService({
        repositoryOverrides: {
          findOne: vi.fn().mockResolvedValue(entity),
        },
      });

      await expect(service.updateProduct(1, {} as any)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('removes a product when deleting', async () => {
      const entity = createProduct();
      const remove = vi.fn().mockResolvedValue(undefined);
      const { service } = createService({
        repositoryOverrides: {
          findOne: vi.fn().mockResolvedValue(entity),
          remove,
        },
      });

      await expect(service.deleteProduct(1)).resolves.toBeUndefined();
      expect(remove).toHaveBeenCalledWith(entity);
    });
  });

  describe('AI assisted operations', () => {
    it('translates a product and persists the changes', async () => {
      const entity = createProduct({ title: 'Original', description: 'Texto' });
      const { service, repository, aiService } = createService({
        repositoryOverrides: {
          findOne: vi.fn().mockResolvedValue(entity),
          save: vi.fn().mockResolvedValue(entity),
        },
      });

      (aiService.translateProductContent as ReturnType<typeof vi.fn>).mockResolvedValue({
        title: 'Translated',
        description: 'Texto traducido',
      });

      const result = await service.translateProduct(1, 'es');
      expect(result.title).toBe('Translated');
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Translated' }));
    });

    it('infers a category for a single product falling back to first option', async () => {
      const entity = createProduct({ category: '' });
      const { service, repository, aiService } = createService({
        repositoryOverrides: {
          findOne: vi.fn().mockResolvedValue(entity),
          save: vi.fn().mockResolvedValue(entity),
        },
      });

      vi.spyOn(service as unknown as { getExistingCategories: () => Promise<string[]> }, 'getExistingCategories')
        .mockResolvedValue(['A', 'B']);
      (aiService.inferCategory as ReturnType<typeof vi.fn>).mockResolvedValue('Unknown');

      const result = await service.inferCategoryForProduct(1);
      expect(result.category).toBe('A');
    });

    it('fails to generate summaries when AI is not configured', async () => {
      const { service, aiService } = createService({
        aiOverrides: { isConfigured: vi.fn().mockReturnValue(false) },
      });

      await expect(service.generateSummariesForProducts()).rejects.toMatchObject({ statusCode: 500 });
      expect(aiService.isConfigured).toHaveBeenCalled();
    });

    it('aggregates errors when generating summaries in bulk', async () => {
      const productA = createProduct({ id: 1, description: 'Text A' });
      const productB = createProduct({ id: 2, description: 'Text B' });
      const { service, repository, aiService } = createService({
        repositoryOverrides: {
          save: vi.fn().mockResolvedValue([productA]),
        },
      });

      vi.spyOn(service as unknown as { findProductsOrdered: (limit?: number) => Promise<Product[]> }, 'findProductsOrdered')
        .mockResolvedValue([productA, productB]);

      (aiService.generateSummary as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('Summary A')
        .mockRejectedValueOnce(new Error('boom'));

      const result = await service.generateSummariesForProducts();
      expect(result.attempted).toBe(2);
      expect(result.updated).toBe(1);
      expect(result.errors).toEqual(['product 2: boom']);
      expect(repository.save).toHaveBeenCalledWith([productA]);
    });

    it('translates products in bulk and skips failures', async () => {
      const productA = createProduct({ id: 1, title: 'A', description: 'A' });
      const productB = createProduct({ id: 2, title: 'B', description: 'B' });
      const { service, repository, aiService } = createService({
        repositoryOverrides: {
          save: vi.fn().mockResolvedValue([productA, productB]),
        },
      });

      vi.spyOn(service as unknown as { findProductsOrdered: (limit?: number) => Promise<Product[]> }, 'findProductsOrdered')
        .mockResolvedValue([productA, productB]);

      (aiService.translateProductContent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ title: 'A-es', description: 'A-es' })
        .mockRejectedValueOnce(new Error('fail'));

      const result = await service.translateProducts('es');
      expect(result.updated).toBe(1);
      expect(result.errors).toEqual(['product 2: fail']);
      expect(productA.title).toBe('A-es');
      expect(repository.save).toHaveBeenCalledWith([productA]);
    });

    it('ensures categories for products missing values', async () => {
      const emptyCategory = createProduct({ id: 3, category: ' ' });
      const filled = createProduct({ id: 4, category: 'existing' });
      const { service, repository, aiService } = createService({
        repositoryOverrides: {
          find: vi.fn().mockResolvedValue([emptyCategory, filled]),
          save: vi.fn().mockResolvedValue([emptyCategory]),
        },
      });

      vi.spyOn(service as unknown as { getExistingCategories: () => Promise<string[]> }, 'getExistingCategories')
        .mockResolvedValue(['Cat1', 'Cat2']);
      (aiService.inferCategory as ReturnType<typeof vi.fn>).mockResolvedValue('Cat2');

      const result = await service.ensureCategoriesForProducts();
      expect(result.attempted).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.products[0].category).toBe('Cat2');
    });

    it('infers categories for ordered products', async () => {
      const productA = createProduct({ id: 7 });
      const productB = createProduct({ id: 8 });
      const { service, repository, aiService } = createService({
        repositoryOverrides: {
          save: vi.fn().mockResolvedValue([productA, productB]),
        },
      });

      vi.spyOn(service as unknown as { getExistingCategories: () => Promise<string[]> }, 'getExistingCategories')
        .mockResolvedValue(['C1']);
      vi.spyOn(service as unknown as { findProductsOrdered: (limit?: number) => Promise<Product[]> }, 'findProductsOrdered')
        .mockResolvedValue([productA, productB]);
      (aiService.inferCategory as ReturnType<typeof vi.fn>).mockResolvedValue('C1');

      const result = await service.inferCategoriesForProducts();
      expect(result.updated).toBe(2);
      expect(repository.save).toHaveBeenCalledWith([productA, productB]);
    });

    it('generates a summary for a specific product', async () => {
      const product = createProduct({ id: 9, description: 'Long description' });
      const { service, repository, aiService } = createService({
        repositoryOverrides: {
          findOne: vi.fn().mockResolvedValue(product),
          save: vi.fn().mockResolvedValue(product),
        },
      });

      (aiService.generateSummary as ReturnType<typeof vi.fn>).mockResolvedValue('Short summary');

      const result = await service.generateSummaryForProduct(9);
      expect(result.aiSummary).toBe('Short summary');
      expect(repository.save).toHaveBeenCalledWith(product);
    });
  });
});
