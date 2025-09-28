import type { NextFunction, Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppError } from '../utils/httpError.js';

type RequestProperty = 'body' | 'params' | 'query';

export function validateRequest<T>(dtoClass: new () => T, property: RequestProperty = 'body') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const instance = plainToInstance(dtoClass, req[property]);

    const errors = await validate(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const formatted = errors.map((error) => ({
        property: error.property,
        constraints: error.constraints,
      }));
      return next(new AppError(400, 'Validation failed', formatted));
    }

    (req as unknown as Record<string, unknown>)[property] = instance;

    return next();
  };
}
