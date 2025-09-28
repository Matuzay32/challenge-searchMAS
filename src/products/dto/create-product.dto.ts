import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined), {
    toClassOnly: true,
  })
  @IsInt()
  @IsPositive()
  extId?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @Transform(({ value }) => (value !== undefined ? Number(value) : value), { toClassOnly: true })
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined), {
    toClassOnly: true,
  })
  @IsString()
  @MaxLength(255)
  category?: string;

  @IsUrl()
  image!: string;

  @IsOptional()
  @IsString()
  aiSummary?: string | null;
}
