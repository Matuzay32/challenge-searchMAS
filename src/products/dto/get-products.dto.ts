import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class GetProductsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1), { toClassOnly: true })
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10), { toClassOnly: true })
  @IsInt()
  @Min(1)
  @Max(100)
  size = 10;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined), {
    toClassOnly: true,
  })
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined), {
    toClassOnly: true,
  })
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined), {
    toClassOnly: true,
  })
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined), {
    toClassOnly: true,
  })
  @IsNumber()
  @IsPositive()
  priceMax?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined), {
    toClassOnly: true,
  })
  @IsIn(['id', 'price', 'title', 'createdAt'])
  sortBy?: 'id' | 'price' | 'title' | 'createdAt';

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : undefined), {
    toClassOnly: true,
  })
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';
}
