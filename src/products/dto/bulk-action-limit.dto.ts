import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class BulkActionLimitDto {
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined), {
    toClassOnly: true,
  })
  @IsInt()
  @Min(1)
  limit?: number;
}
