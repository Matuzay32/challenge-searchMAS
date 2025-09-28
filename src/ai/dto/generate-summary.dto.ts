import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GenerateSummaryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;
}
