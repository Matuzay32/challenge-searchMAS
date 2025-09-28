const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Challenge Search MAS API',
    version: '1.0.0',
    description:
      'API para sincronizar productos desde Fake Store, almacenarlos en Postgres y generar resúmenes con OpenAI.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local',
    },
  ],
  tags: [
    { name: 'Products', description: 'Operaciones sobre productos' },
    { name: 'AI', description: 'Operaciones relacionadas a IA' },
  ],
  paths: {
    '/api/external-data': {
      post: {
        tags: ['Products'],
        summary: 'Sincroniza productos desde Fake Store',
        responses: {
          '201': {
            description: 'Productos sincronizados correctamente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExternalSyncResponse' },
              },
            },
          },
          '500': {
            description: 'Error interno al sincronizar',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/data': {
      get: {
        tags: ['Products'],
        summary: 'Lista productos con filtros y paginación',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1, minimum: 1 } },
          {
            in: 'query',
            name: 'size',
            schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
          },
          { in: 'query', name: 'q', schema: { type: 'string' } },
          { in: 'query', name: 'category', schema: { type: 'string' } },
          { in: 'query', name: 'priceMin', schema: { type: 'number', minimum: 0 } },
          { in: 'query', name: 'priceMax', schema: { type: 'number', minimum: 0 } },
          {
            in: 'query',
            name: 'sortBy',
            schema: { type: 'string', enum: ['id', 'price', 'title', 'createdAt'] },
          },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
        ],
        responses: {
          '200': {
            description: 'Listado paginado de productos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedProducts' },
              },
            },
          },
          '400': {
            description: 'Parámetros de consulta inválidos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/export-csv': {
      get: {
        tags: ['Products'],
        summary: 'Exporta todos los productos en formato CSV',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'size', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { in: 'query', name: 'q', schema: { type: 'string' } },
          { in: 'query', name: 'category', schema: { type: 'string' } },
          { in: 'query', name: 'priceMin', schema: { type: 'number', minimum: 0 } },
          { in: 'query', name: 'priceMax', schema: { type: 'number', minimum: 0 } },
          {
            in: 'query',
            name: 'sortBy',
            schema: { type: 'string', enum: ['id', 'price', 'title', 'createdAt'] },
          },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
        ],
        responses: {
          '200': {
            description: 'Archivo CSV con los productos',
            content: {
              'text/csv': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
        },
      },
    },
    '/api/products/import': {
      post: {
        tags: ['Products'],
        summary: 'Importa productos a partir de un archivo CSV',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description:
                      'Archivo CSV con columnas id, extId, title, description, price, category, image, aiSummary',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Resumen del proceso de importación',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ImportSummary' },
              },
            },
          },
          '400': {
            description: 'Archivo faltante o inválido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/products/generate-summaries': {
      post: {
        tags: ['Products'],
        summary: 'Genera resúmenes con IA para varios productos',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BulkLimitRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Resultado de la operación masiva',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BulkOperationResult' },
              },
            },
          },
          '500': {
            description: 'Error al comunicarse con OpenAI',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/products/translate-all': {
      post: {
        tags: ['Products'],
        summary: 'Traduce el contenido de múltiples productos',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BulkTranslateRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Resultado de la traducción masiva',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BulkOperationResult' },
              },
            },
          },
          '500': {
            description: 'Error al comunicarse con OpenAI',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/products/generate-categories': {
      post: {
        tags: ['Products'],
        summary: 'Garantiza que todos los productos tengan categoría',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BulkLimitRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Resultado de la operación masiva',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BulkOperationResult' },
              },
            },
          },
          '400': {
            description: 'No hay categorías configuradas para inferir',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/products/infer-categories': {
      post: {
        tags: ['Products'],
        summary: 'Inferir categorías con IA para múltiples productos',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BulkLimitRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Resultado de la operación masiva',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BulkOperationResult' },
              },
            },
          },
          '400': {
            description: 'No hay categorías configuradas para inferir',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/products': {
      post: {
        tags: ['Products'],
        summary: 'Crear un producto manualmente',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProductInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Producto creado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          '400': {
            description: 'Datos inválidos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/products/{id}': {
      put: {
        tags: ['Products'],
        summary: 'Reemplaza completamente un producto',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'integer', minimum: 1 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateProductInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Producto actualizado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          '404': {
            description: 'Producto no encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Products'],
        summary: 'Actualiza parcialmente un producto',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'integer', minimum: 1 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateProductInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Producto actualizado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          '404': {
            description: 'Producto no encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Elimina un producto',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'integer', minimum: 1 },
          },
        ],
        responses: {
          '204': {
            description: 'Producto eliminado',
          },
          '404': {
            description: 'Producto no encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/products/{id}/translate': {
      post: {
        tags: ['Products'],
        summary: 'Traduce un producto específico',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'integer', minimum: 1 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TranslateProductRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Producto traducido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          '404': {
            description: 'Producto no encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/products/{id}/generate-summary': {
      post: {
        tags: ['Products'],
        summary: 'Genera un resumen con IA para un producto',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'integer', minimum: 1 },
          },
        ],
        responses: {
          '200': {
            description: 'Producto con resumen actualizado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          '404': {
            description: 'Producto no encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
          '500': {
            description: 'Error al comunicarse con OpenAI',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/products/{id}/infer-category': {
      post: {
        tags: ['Products'],
        summary: 'Inferir categoría con IA para un producto',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'integer', minimum: 1 },
          },
        ],
        responses: {
          '200': {
            description: 'Producto con categoría inferida',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          '404': {
            description: 'Producto no encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
          '400': {
            description: 'No hay categorías configuradas para inferir',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/ai/summary': {
      post: {
        tags: ['AI'],
        summary: 'Genera un resumen corto usando OpenAI',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GenerateSummaryRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Resumen generado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AiSummaryResponse' },
              },
            },
          },
          '400': {
            description: 'Solicitud inválida',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
          '500': {
            description: 'Error al comunicarse con OpenAI',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ApiError: {
        type: 'object',
        properties: {
          status: { type: 'integer', example: 400 },
          message: { type: 'string', example: 'Mensaje de error' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          extId: { type: 'integer', nullable: true, example: 12 },
          title: { type: 'string', example: 'Elegant Cotton Shirt' },
          description: {
            type: 'string',
            example: 'Camisa de algodón con corte slim y detalles en contraste.',
          },
          price: { type: 'number', format: 'float', example: 49.99 },
          category: { type: 'string', example: 'clothing' },
          image: {
            type: 'string',
            format: 'uri',
            example: 'https://fakestoreapi.com/img/71-3HjGNDUL._AC_SY879._SX._UX._SY._UY_t.png',
          },
          aiSummary: {
            type: 'string',
            nullable: true,
            example: 'Camisa ligera ideal para el uso diario.',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-05-08T12:34:56.000Z',
          },
        },
      },
      PaginatedProducts: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Product' },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              size: { type: 'integer', example: 10 },
              total: { type: 'integer', example: 42 },
              totalPages: { type: 'integer', example: 5 },
            },
          },
          stats: {
            type: 'object',
            properties: {
              byCategory: {
                type: 'object',
                additionalProperties: { type: 'integer' },
                example: {
                  electronics: 12,
                  clothing: 8,
                },
              },
            },
          },
        },
      },
      ExternalSyncResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'External data synchronized successfully',
          },
          count: { type: 'integer', example: 20 },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Product' },
          },
        },
      },
      ImportSummary: {
        type: 'object',
        properties: {
          created: { type: 'integer', example: 5 },
          updated: { type: 'integer', example: 3 },
          errors: {
            type: 'array',
            items: { type: 'string' },
            example: ['Fila 3: price debe ser mayor o igual a 0'],
          },
        },
      },
      BulkOperationResult: {
        type: 'object',
        properties: {
          attempted: { type: 'integer', example: 10 },
          updated: { type: 'integer', example: 8 },
          errors: {
            type: 'array',
            items: { type: 'string' },
            example: ['product 2: OpenAI API key is not configured'],
          },
          products: {
            type: 'array',
            items: { $ref: '#/components/schemas/Product' },
          },
        },
      },
      BulkLimitRequest: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            minimum: 1,
            example: 5,
            description: 'Cantidad máxima de productos a procesar',
          },
        },
      },
      BulkTranslateRequest: {
        allOf: [
          { $ref: '#/components/schemas/BulkLimitRequest' },
          {
            type: 'object',
            required: ['lang'],
            properties: {
              lang: {
                type: 'string',
                example: 'es',
                description: 'Código de idioma ISO 639 (ej. es, en-US)',
              },
            },
          },
        ],
      },
      TranslateProductRequest: {
        type: 'object',
        required: ['lang'],
        properties: {
          lang: {
            type: 'string',
            example: 'es',
            description: 'Código de idioma ISO 639 (ej. es, en-US)',
          },
        },
      },
      CreateProductInput: {
        type: 'object',
        required: ['title', 'description', 'price', 'image'],
        properties: {
          extId: {
            type: 'integer',
            minimum: 1,
            example: 42,
            nullable: true,
          },
          title: { type: 'string', example: 'Elegant Cotton Shirt' },
          description: {
            type: 'string',
            example: 'Camisa de algodón con corte slim y detalles en contraste.',
          },
          price: { type: 'number', format: 'float', example: 49.99 },
          category: { type: 'string', example: 'clothing' },
          image: {
            type: 'string',
            format: 'uri',
            example: 'https://fakestoreapi.com/img/71-3HjGNDUL._AC_SY879._SX._UX._SY._UY_t.png',
          },
          aiSummary: {
            type: 'string',
            nullable: true,
            example: 'Camisa ligera ideal para el uso diario.',
          },
        },
      },
      UpdateProductInput: {
        type: 'object',
        properties: {
          title: { type: 'string', example: 'Elegant Cotton Shirt' },
          description: {
            type: 'string',
            example: 'Camisa de algodón con corte slim y detalles en contraste.',
          },
          price: { type: 'number', format: 'float', example: 49.99 },
          category: {
            type: 'string',
            nullable: true,
            example: 'clothing',
          },
          image: {
            type: 'string',
            format: 'uri',
            example: 'https://fakestoreapi.com/img/71-3HjGNDUL._AC_SY879._SX._UX._SY._UY_t.png',
          },
          aiSummary: {
            type: 'string',
            nullable: true,
            example: 'Camisa ligera ideal para el uso diario.',
          },
        },
      },
      GenerateSummaryRequest: {
        type: 'object',
        required: ['text'],
        properties: {
          text: {
            type: 'string',
            example: 'Descripción larga del producto a resumir.',
          },
        },
      },
      AiSummaryResponse: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            example: 'Resumen generado por IA del contenido proporcionado.',
          },
        },
      },
    },
  },
};

export default swaggerDocument;
