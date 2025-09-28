import type { NextFunction, Request, Response } from 'express';
import { ProductsService } from './products.service.js';
import { GetProductsQueryDto } from './dto/get-products.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductIdParamDto } from './dto/product-id-param.dto.js';
import { TranslateProductDto } from './dto/translate-product.dto.js';
import { BulkGenerateSummariesDto } from './dto/bulk-generate-summaries.dto.js';
import { BulkTranslateProductsDto } from './dto/bulk-translate-products.dto.js';
import { BulkEnsureCategoriesDto } from './dto/bulk-ensure-categories.dto.js';
import { BulkInferCategoriesDto } from './dto/bulk-infer-categories.dto.js';
import type { RequestWithFile } from '../middlewares/singleFileUpload.js';
import { AppError } from '../utils/httpError.js';

export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  importExternalData = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await this.productsService.syncExternalData();
      res.status(201).json({
        message: 'External data synchronized successfully',
        count: products.length,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  };

  getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as GetProductsQueryDto;
      const result = await this.productsService.getProducts(query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  exportCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as GetProductsQueryDto | undefined;
      const csv = await this.productsService.exportAsCsv(query);
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', 'attachment; filename="products.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  };

  importCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as RequestWithFile).file;
      if (!file) {
        throw new AppError(400, 'CSV file is required');
      }

      const result = await this.productsService.importFromCsv(file.buffer);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateProductDto;
      const product = await this.productsService.createProduct(body);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.params as unknown as ProductIdParamDto;
      const body = req.body as UpdateProductDto;
      const product = await this.productsService.updateProduct(params.id, body);
      res.json(product);
    } catch (error) {
      next(error);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.params as unknown as ProductIdParamDto;
      await this.productsService.deleteProduct(params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  translateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.params as unknown as ProductIdParamDto;
      const body = req.body as TranslateProductDto;
      const product = await this.productsService.translateProduct(params.id, body.lang);
      res.json(product);
    } catch (error) {
      next(error);
    }
  };

  inferCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.params as unknown as ProductIdParamDto;
      const product = await this.productsService.inferCategoryForProduct(params.id);
      res.json(product);
    } catch (error) {
      next(error);
    }
  };

  generateSummaries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as BulkGenerateSummariesDto;
      const result = await this.productsService.generateSummariesForProducts(body.limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  translateAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as BulkTranslateProductsDto;

      const result = await this.productsService.translateProducts(body.lang, body.limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  ensureCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as BulkEnsureCategoriesDto;
      const result = await this.productsService.ensureCategoriesForProducts(body.limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  inferCategoriesBulk = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as BulkInferCategoriesDto;
      const result = await this.productsService.inferCategoriesForProducts(body.limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  generateSummaryForProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.params as unknown as ProductIdParamDto;
      const product = await this.productsService.generateSummaryForProduct(params.id);
      res.json(product);
    } catch (error) {
      next(error);
    }
  };
}
