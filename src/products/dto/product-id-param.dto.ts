import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ProductIdParamDto {
  @Transform(({ value }) => Number(value), { toClassOnly: true })
  @IsInt()
  @Min(1)
  id!: number;
}
