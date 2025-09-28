import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class TranslateProductDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value), { toClassOnly: true })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/, {
    message: 'lang must be a valid ISO code, e.g., es or en-US',
  })
  lang!: string;
}
