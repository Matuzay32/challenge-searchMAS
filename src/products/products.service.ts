import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { In } from 'typeorm';
import { Parser } from 'json2csv';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { Product } from '../database/entities/product.entity.js';
import { AppError } from '../utils/httpError.js';
import { GetProductsQueryDto } from './dto/get-products.dto.js';
import { AiService } from '../ai/ai.service.js';
import { ImportProductRowDto } from './dto/import-product-row.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

const DEFAULT_SUMMARY_LIMIT = Number(process.env.SUMMARY_LIMIT ?? 5);

interface ExternalProduct {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  image: string;
}

export interface PaginatedProducts {
  data: ProductResponse[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
  stats: {
    byCategory: Record<string, number>;
  };
}

export interface ProductResponse {
  id: number;
  extId: number;
  title: string;
  description: string;
  price: number;
  category: string;
  image: string;
  aiSummary: string | null;
  createdAt: string;
}

export interface ImportSummary {
  created: number;
  updated: number;
  errors: string[];
}

interface BulkOperationResult {
  attempted: number;
  updated: number;
  errors: string[];
  products: ProductResponse[];
}

export class ProductsService {
  private readonly repository: Repository<Product>;

  private readonly externalApi: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly aiService: AiService,
  ) {
    this.repository = this.dataSource.getRepository(Product);
    this.externalApi = process.env.EXTERNAL_API ?? 'https://fakestoreapi.com/products';
  }

  private mapEntity(entity: Product): ProductResponse {
    return {
      id: entity.id,
      extId: entity.extId,
      title: entity.title,
      description: entity.description,
      price: Number(entity.price),
      category: entity.category,
      image: entity.image,
      aiSummary: entity.aiSummary,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  private async getExistingCategories(): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('product')
      .select('DISTINCT product.category', 'category')
      .orderBy('product.category', 'ASC')
      .getRawMany<{ category: string }>();

    return rows.map((row) => row.category).filter((category) => category);
  }

  private normalizePrice(value: number): string {
    return Number(value).toFixed(2);
  }

  private async findProductsOrdered(limit?: number): Promise<Product[]> {
    const qb = this.repository.createQueryBuilder('product').orderBy('product.id', 'ASC');

    if (limit !== undefined) {
      qb.take(limit);
    }

    return qb.getMany();
  }

  private applyFilters(
    qb: SelectQueryBuilder<Product>,
    {
      q,
      category,
      priceMin,
      priceMax,
    }: Pick<GetProductsQueryDto, 'q' | 'category' | 'priceMin' | 'priceMax'>,
  ): void {
    if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
      throw new AppError(400, 'priceMin cannot be greater than priceMax');
    }

    if (q) {
      qb.andWhere('(product.title ILIKE :q OR product.description ILIKE :q)', {
        q: `%${q}%`,
      });
    }

    if (category) {
      qb.andWhere('product.category = :category', { category });
    }

    if (priceMin !== undefined) {
      qb.andWhere('product.price >= :priceMin', { priceMin });
    }

    if (priceMax !== undefined) {
      qb.andWhere('product.price <= :priceMax', { priceMax });
    }
  }

  private applySorting(
    qb: SelectQueryBuilder<Product>,
    sortBy: GetProductsQueryDto['sortBy'],
    order: GetProductsQueryDto['order'],
  ): void {
    const columnMap: Record<string, string> = {
      id: 'product.id',
      price: 'product.price',
      title: 'product.title',
      createdAt: 'product.createdAt',
    };

    const sortColumn = columnMap[sortBy ?? 'id'] ?? columnMap.id;
    const sortOrder = order ?? 'ASC';

    qb.orderBy(sortColumn, sortOrder);
  }

  private parseCsvRows(content: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let index = 0; index < content.length; index += 1) {
      const char = content[index];

      if (insideQuotes) {
        if (char === '"') {
          if (content[index + 1] === '"') {
            currentField += '"';
            index += 1;
          } else {
            insideQuotes = false;
          }
        } else {
          currentField += char;
        }

        continue;
      }

      if (char === '"') {
        insideQuotes = true;
        continue;
      }

      if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        continue;
      }

      if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        continue;
      }

      if (char === '\r') {
        continue;
      }

      currentField += char;
    }

    if (insideQuotes) {
      throw new AppError(400, 'Invalid CSV format: mismatched quotes');
    }

    currentRow.push(currentField);
    if (currentRow.some((value) => value.trim() !== '')) {
      rows.push(currentRow);
    }

    return rows.filter((row) => row.some((value) => value.trim() !== ''));
  }

  private parseCsv(buffer: Buffer): Record<string, string>[] {
    const content = buffer.toString('utf8');
    if (!content.trim()) {
      return [];
    }

    const rows = this.parseCsvRows(content);
    if (rows.length === 0) {
      return [];
    }

    const headers = rows[0];
    return rows.slice(1).map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? '';
      });
      return record;
    });
  }

  private async resolveCategory(
    candidate: string | undefined | null,
    product: { title: string; description: string },
    cachedCategories?: string[],
  ): Promise<string> {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }

    const categories = cachedCategories ?? (await this.getExistingCategories());

    if (!categories.length) {
      throw new AppError(400, 'No categories available to infer');
    }

    const inferred = await this.aiService.inferCategory({
      title: product.title,
      description: product.description,
      categories,
    });

    if (categories.includes(inferred)) {
      return inferred;
    }

    return categories[0];
  }

  private formatValidationErrors(errors: ValidationError[]): string {
    return errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .filter(Boolean)
      .join(', ');
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof AppError) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }

  private async generateUniqueExtId(exclude?: Set<number>): Promise<number> {
    let candidate = Math.floor(Date.now() / 1000);

    while (
      exclude?.has(candidate) ||
      (await this.repository.exist({ where: { extId: candidate } }))
    ) {
      candidate += 1;
    }

    exclude?.add(candidate);
    return candidate;
  }

  private async upsertImportedProduct(
    row: ImportProductRowDto,
    categoriesCache: string[],
    extIdsInBatch: Set<number>,
  ): Promise<'created' | 'updated'> {
    let entity: Product | null = null;

    if (row.extId !== undefined) {
      entity = await this.repository.findOne({ where: { extId: row.extId } });
    }

    if (!entity && row.id !== undefined) {
      entity = await this.repository.findOne({ where: { id: row.id } });
    }

    const category = await this.resolveCategory(
      row.category,
      { title: row.title, description: row.description },
      categoriesCache,
    );

    if (!categoriesCache.includes(category)) {
      categoriesCache.push(category);
    }

    let extId = entity?.extId ?? row.extId;
    if (extId !== undefined) {
      extIdsInBatch.add(extId);
    } else {
      extId = await this.generateUniqueExtId(extIdsInBatch);
    }

    const payload: Partial<Product> = {
      extId,
      title: row.title,
      description: row.description,
      price: this.normalizePrice(row.price),
      category,
      image: row.image,
      aiSummary: row.aiSummary ?? null,
    };

    if (entity) {
      this.repository.merge(entity, payload);
      await this.repository.save(entity);
      return 'updated';
    }

    if (row.extId === undefined) {
      throw new AppError(400, 'extId is required to create new products from CSV');
    }

    const product = this.repository.create(payload);
    await this.repository.save(product);
    return 'created';
  }

  async syncExternalData(summaryLimit = DEFAULT_SUMMARY_LIMIT): Promise<ProductResponse[]> {
    const normalizedLimit = Number.isNaN(summaryLimit)
      ? DEFAULT_SUMMARY_LIMIT
      : Math.max(0, summaryLimit);

    const response = await fetch(this.externalApi);

    if (!response.ok) {
      throw new AppError(502, `Failed to fetch external data: ${response.statusText}`);
    }

    const payload = (await response.json()) as ExternalProduct[];
    if (!Array.isArray(payload)) {
      throw new AppError(502, 'External API returned an unexpected payload');
    }

    const extIds: number[] = payload.map((product) => product.id);
    const productsToUpsert: Partial<Product>[] = [];

    for (let index = 0; index < payload.length; index += 1) {
      const product = payload[index];
      let aiSummary: string | null = null;

      if (index < normalizedLimit && this.aiService.isConfigured()) {
        try {
          aiSummary = await this.aiService.generateSummary(product.description);
        } catch (error) {
          // Ignore summary errors for individual items but continue processing others
          aiSummary = null;
        }
      }

      productsToUpsert.push({
        extId: product.id,
        title: product.title,
        description: product.description,
        price: Number(product.price).toFixed(2),
        category: product.category,
        image: product.image,
        aiSummary,
      });
    }

    await this.repository.upsert(productsToUpsert, ['extId']);

    const entities = await this.repository.find({
      where: { extId: In(extIds) },
      order: { id: 'ASC' },
    });

    return entities.map((entity) => this.mapEntity(entity));
  }

  async getProducts(query: GetProductsQueryDto): Promise<PaginatedProducts> {
    const { page, size, sortBy, order } = query;
    const qb = this.repository.createQueryBuilder('product');

    this.applyFilters(qb, query);
    this.applySorting(qb, sortBy, order);

    qb.skip((page - 1) * size);
    qb.take(size);

    const [entities, total] = await qb.getManyAndCount();

    const statsRaw = await this.repository
      .createQueryBuilder('product')
      .select('product.category', 'category')
      .addSelect('COUNT(product.id)', 'count')
      .groupBy('product.category')
      .getRawMany<{ category: string; count: string }>();

    const stats = statsRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = Number(row.count);
      return acc;
    }, {});

    return {
      data: entities.map((entity) => this.mapEntity(entity)),
      pagination: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size) || 1,
      },
      stats: {
        byCategory: stats,
      },
    };
  }

  async exportAsCsv(query?: GetProductsQueryDto): Promise<string> {
    const qb = this.repository.createQueryBuilder('product');

    if (query) {
      this.applyFilters(qb, query);
      this.applySorting(qb, query.sortBy, query.order);
    } else {
      this.applySorting(qb, undefined, undefined);
    }

    const products = await qb.getMany();
    const parser = new Parser<ProductResponse>({
      fields: [
        'id',
        'extId',
        'title',
        'description',
        'price',
        'category',
        'image',
        'aiSummary',
        'createdAt',
      ],
    });

    const records = products.map((product) => this.mapEntity(product));
    return parser.parse(records);
  }

  async importFromCsv(fileBuffer: Buffer): Promise<ImportSummary> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError(400, 'CSV file is required');
    }

    let records: Record<string, string>[];

    try {
      records = this.parseCsv(fileBuffer);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(400, 'Failed to parse CSV file', error);
    }

    const summary: ImportSummary = { created: 0, updated: 0, errors: [] };

    if (records.length === 0) {
      return summary;
    }

    const categoriesCache = await this.getExistingCategories();
    const extIdsInBatch = new Set<number>();

    for (let index = 0; index < records.length; index += 1) {
      const rowNumber = index + 2; // account for header row
      const instance = plainToInstance(ImportProductRowDto, records[index]);
      const validationErrors = validateSync(instance as object, {
        whitelist: true,
        forbidNonWhitelisted: false,
      });

      if (validationErrors.length > 0) {
        summary.errors.push(`fila ${rowNumber}: ${this.formatValidationErrors(validationErrors)}`);
        continue;
      }

      try {
        const result = await this.upsertImportedProduct(instance, categoriesCache, extIdsInBatch);
        if (result === 'created') {
          summary.created += 1;
        } else {
          summary.updated += 1;
        }
      } catch (error) {
        if (error instanceof AppError) {
          summary.errors.push(`fila ${rowNumber}: ${error.message}`);
        } else if (error instanceof Error) {
          summary.errors.push(`fila ${rowNumber}: ${error.message}`);
        } else {
          summary.errors.push(`fila ${rowNumber}: Unknown error`);
        }
      }
    }

    return summary;
  }

  async createProduct(dto: CreateProductDto): Promise<ProductResponse> {
    const categoriesCache = await this.getExistingCategories();
    const category = await this.resolveCategory(
      dto.category,
      { title: dto.title, description: dto.description },
      categoriesCache,
    );

    const product = this.repository.create({
      extId: dto.extId ?? (await this.generateUniqueExtId()),
      title: dto.title,
      description: dto.description,
      price: this.normalizePrice(dto.price),
      category,
      image: dto.image,
      aiSummary: dto.aiSummary ?? null,
    });

    try {
      const saved = await this.repository.save(product);
      return this.mapEntity(saved);
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key value')) {
        throw new AppError(409, 'A product with the same extId already exists');
      }

      throw error;
    }
  }

  async updateProduct(id: number, dto: UpdateProductDto): Promise<ProductResponse> {
    const product = await this.repository.findOne({ where: { id } });
    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    let hasChanges = false;

    if (dto.title !== undefined) {
      product.title = dto.title;
      hasChanges = true;
    }

    if (dto.description !== undefined) {
      product.description = dto.description;
      hasChanges = true;
    }

    if (dto.price !== undefined) {
      product.price = this.normalizePrice(dto.price);
      hasChanges = true;
    }

    if (dto.image !== undefined) {
      product.image = dto.image;
      hasChanges = true;
    }

    if (dto.aiSummary !== undefined) {
      product.aiSummary = dto.aiSummary ?? null;
      hasChanges = true;
    }

    if (dto.category !== undefined) {
      const categoriesCache = await this.getExistingCategories();
      const category = await this.resolveCategory(
        dto.category,
        { title: product.title, description: product.description },
        categoriesCache,
      );
      product.category = category;
      hasChanges = true;
    }

    if (!hasChanges) {
      throw new AppError(400, 'No fields provided for update');
    }

    const saved = await this.repository.save(product);
    return this.mapEntity(saved);
  }

  async deleteProduct(id: number): Promise<void> {
    const product = await this.repository.findOne({ where: { id } });
    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    await this.repository.remove(product);
  }

  async translateProduct(id: number, targetLanguage: string): Promise<ProductResponse> {
    const product = await this.repository.findOne({ where: { id } });
    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    const translation = await this.aiService.translateProductContent({
      title: product.title,
      description: product.description,
      targetLanguage,
    });

    product.title = translation.title;
    product.description = translation.description;

    const saved = await this.repository.save(product);
    return this.mapEntity(saved);
  }

  async inferCategoryForProduct(id: number): Promise<ProductResponse> {
    const product = await this.repository.findOne({ where: { id } });
    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    const categories = await this.getExistingCategories();
    if (!categories.length) {
      throw new AppError(400, 'No categories available to infer');
    }

    const inferred = await this.aiService.inferCategory({
      title: product.title,
      description: product.description,
      categories,
    });

    product.category = categories.includes(inferred) ? inferred : categories[0];

    const saved = await this.repository.save(product);
    return this.mapEntity(saved);
  }

  async generateSummariesForProducts(limit?: number): Promise<BulkOperationResult> {
    if (!this.aiService.isConfigured()) {
      throw new AppError(500, 'OpenAI API key is not configured');
    }

    const products = await this.findProductsOrdered(limit);
    const updates: Product[] = [];
    const errors: string[] = [];

    for (const product of products) {
      try {
        product.aiSummary = await this.aiService.generateSummary(product.description);
        updates.push(product);
      } catch (error) {
        errors.push(`product ${product.id}: ${this.extractErrorMessage(error)}`);
      }
    }

    if (updates.length > 0) {
      await this.repository.save(updates);
    }

    return {
      attempted: products.length,
      updated: updates.length,
      errors,
      products: updates.map((entity) => this.mapEntity(entity)),
    };
  }

  async translateProducts(targetLanguage: string, limit?: number): Promise<BulkOperationResult> {
    if (!this.aiService.isConfigured()) {
      throw new AppError(500, 'OpenAI API key is not configured');
    }

    const products = await this.findProductsOrdered(limit);
    const updates: Product[] = [];
    const errors: string[] = [];

    for (const product of products) {
      try {
        const translation = await this.aiService.translateProductContent({
          title: product.title,
          description: product.description,
          targetLanguage,
        });

        product.title = translation.title;
        product.description = translation.description;
        updates.push(product);
      } catch (error) {
        errors.push(`product ${product.id}: ${this.extractErrorMessage(error)}`);
      }
    }

    if (updates.length > 0) {
      await this.repository.save(updates);
    }

    return {
      attempted: products.length,
      updated: updates.length,
      errors,
      products: updates.map((entity) => this.mapEntity(entity)),
    };
  }

  async ensureCategoriesForProducts(limit?: number): Promise<BulkOperationResult> {
    const categories = await this.getExistingCategories();
    const validCategories = categories.filter((category) => category?.trim().length > 0);

    if (!validCategories.length) {
      throw new AppError(400, 'No categories available to infer');
    }

    const allProducts = await this.repository.find({ order: { id: 'ASC' } });
    const targets = allProducts.filter((product) => !product.category || !product.category.trim());
    const limitedTargets = limit ? targets.slice(0, limit) : targets;

    const updates: Product[] = [];
    const errors: string[] = [];

    for (const product of limitedTargets) {
      try {
        const inferred = await this.aiService.inferCategory({
          title: product.title,
          description: product.description,
          categories: validCategories,
        });

        product.category = validCategories.includes(inferred) ? inferred : validCategories[0];
        updates.push(product);
      } catch (error) {
        errors.push(`product ${product.id}: ${this.extractErrorMessage(error)}`);
      }
    }

    if (updates.length > 0) {
      await this.repository.save(updates);
    }

    return {
      attempted: limitedTargets.length,
      updated: updates.length,
      errors,
      products: updates.map((entity) => this.mapEntity(entity)),
    };
  }

  async inferCategoriesForProducts(limit?: number): Promise<BulkOperationResult> {
    const categories = await this.getExistingCategories();
    const validCategories = categories.filter((category) => category?.trim().length > 0);

    if (!validCategories.length) {
      throw new AppError(400, 'No categories available to infer');
    }

    const products = await this.findProductsOrdered(limit);
    const updates: Product[] = [];
    const errors: string[] = [];

    for (const product of products) {
      try {
        const inferred = await this.aiService.inferCategory({
          title: product.title,
          description: product.description,
          categories: validCategories,
        });

        product.category = validCategories.includes(inferred) ? inferred : validCategories[0];
        updates.push(product);
      } catch (error) {
        errors.push(`product ${product.id}: ${this.extractErrorMessage(error)}`);
      }
    }

    if (updates.length > 0) {
      await this.repository.save(updates);
    }

    return {
      attempted: products.length,
      updated: updates.length,
      errors,
      products: updates.map((entity) => this.mapEntity(entity)),
    };
  }

  async generateSummaryForProduct(id: number): Promise<ProductResponse> {
    if (!this.aiService.isConfigured()) {
      throw new AppError(500, 'OpenAI API key is not configured');
    }

    const product = await this.repository.findOne({ where: { id } });
    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    product.aiSummary = await this.aiService.generateSummary(product.description);

    const saved = await this.repository.save(product);
    return this.mapEntity(saved);
  }
}
