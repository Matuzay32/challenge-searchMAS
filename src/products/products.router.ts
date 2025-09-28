import { Router } from 'express';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { GetProductsQueryDto } from './dto/get-products.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductIdParamDto } from './dto/product-id-param.dto.js';
import { TranslateProductDto } from './dto/translate-product.dto.js';
import { singleFileUpload } from '../middlewares/singleFileUpload.js';
import { BulkGenerateSummariesDto } from './dto/bulk-generate-summaries.dto.js';
import { BulkTranslateProductsDto } from './dto/bulk-translate-products.dto.js';
import { BulkEnsureCategoriesDto } from './dto/bulk-ensure-categories.dto.js';
import { BulkInferCategoriesDto } from './dto/bulk-infer-categories.dto.js';

export function createProductsRouter(productsService: ProductsService): Router {
  const router = Router();
  const controller = new ProductsController(productsService);

  router.post('/external-data', controller.importExternalData);
  router.get('/data', validateRequest(GetProductsQueryDto, 'query'), controller.getProducts);
  router.get('/export-csv', validateRequest(GetProductsQueryDto, 'query'), controller.exportCsv);
  router.post('/products/import', singleFileUpload('file'), controller.importCsv);
  router.post(
    '/products/generate-summaries',
    validateRequest(BulkGenerateSummariesDto),
    controller.generateSummaries,
  );
  router.post(
    '/products/translate-all',
    validateRequest(BulkTranslateProductsDto),
    controller.translateAll,
  );
  router.post(
    '/products/generate-categories',
    validateRequest(BulkEnsureCategoriesDto),
    controller.ensureCategories,
  );
  router.post(
    '/products/infer-categories',
    validateRequest(BulkInferCategoriesDto),
    controller.inferCategoriesBulk,
  );
  router.post('/products', validateRequest(CreateProductDto), controller.createProduct);
  router.put(
    '/products/:id',
    validateRequest(ProductIdParamDto, 'params'),
    validateRequest(UpdateProductDto),
    controller.updateProduct,
  );
  router.patch(
    '/products/:id',
    validateRequest(ProductIdParamDto, 'params'),
    validateRequest(UpdateProductDto),
    controller.updateProduct,
  );
  router.delete(
    '/products/:id',
    validateRequest(ProductIdParamDto, 'params'),
    controller.deleteProduct,
  );
  router.post(
    '/products/:id/translate',
    validateRequest(ProductIdParamDto, 'params'),
    validateRequest(TranslateProductDto),
    controller.translateProduct,
  );
  router.post(
    '/products/:id/generate-summary',
    validateRequest(ProductIdParamDto, 'params'),
    controller.generateSummaryForProduct,
  );
  router.post(
    '/products/:id/infer-category',
    validateRequest(ProductIdParamDto, 'params'),
    controller.inferCategory,
  );

  return router;
}
