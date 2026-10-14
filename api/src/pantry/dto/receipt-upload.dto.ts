import { IsOptional, IsString, MaxLength } from 'class-validator';

/** The non-file fields of a multipart receipt upload. */
export class ReceiptUploadDto {
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  text?: string;
}
