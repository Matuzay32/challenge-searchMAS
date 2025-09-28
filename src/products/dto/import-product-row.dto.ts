import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class ImportProductRowDto {
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined), {
    toClassOnly: true,
  })
  @IsInt()
  @Min(1)
  id?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined), {
    toClassOnly: true,
  })
  @IsInt()
  extId?: number;

  @Transform(({ value }) => (typeof value === 'string' ? value : undefined), { toClassOnly: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value : undefined), { toClassOnly: true })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined), {
    toClassOnly: true,
  })
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined), { toClassOnly: true })
  @IsString()
  @MaxLength(255)
  category?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value : undefined), { toClassOnly: true })
  @IsUrl()
  image!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : value ?? null), { toClassOnly: true })
  @IsString()
  aiSummary?: string | null;
}
