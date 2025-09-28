import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : undefined), { toClassOnly: true })
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : undefined), { toClassOnly: true })
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : value), { toClassOnly: true })
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value), { toClassOnly: true })
  @IsString()
  @MaxLength(255)
  category?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : undefined), { toClassOnly: true })
  @IsUrl()
  image?: string;

  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : value ?? null), { toClassOnly: true })
  @IsString()
  aiSummary?: string | null;
}
