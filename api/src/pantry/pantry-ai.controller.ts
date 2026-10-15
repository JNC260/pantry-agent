import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CookedRecipeDto } from './dto/cooked-recipe.dto';
import { ReceiptUploadDto } from './dto/receipt-upload.dto';
import { PantryAiService } from './pantry-ai.service';

// The formats Claude reads directly. The web app shrinks large photos
// before upload; a PDF order receipt is well under the size cap.
const RECEIPT_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);
const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * /pantry/ai routes (all require a JWT): AI-proposed pantry changes for the
 * user to review. The web app applies what they approve via /pantry/batch.
 */
@Controller('pantry/ai')
@UseGuards(JwtAuthGuard)
export class PantryAiController {
  constructor(private readonly pantryAiService: PantryAiService) {}

  /** Multipart: up to 6 `files` (images or PDFs) and/or a `text` field. */
  @Post('receipt')
  @HttpCode(200)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (RECEIPT_MEDIA_TYPES.has(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Unsupported file type ${file.mimetype}; use an image or PDF`,
            ),
            false,
          );
        }
      },
    }),
  )
  parseReceipt(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() { text }: ReceiptUploadDto,
  ) {
    if (!files?.length && !text?.trim()) {
      throw new BadRequestException('Send a receipt file or some text');
    }
    return this.pantryAiService.parseReceipt(files ?? [], text);
  }

  /** JSON: a recipe `url` or pasted `ingredientsText`, plus `servings`. */
  @Post('cooked')
  @HttpCode(200)
  planCooked(@Body() dto: CookedRecipeDto) {
    if (!dto.url === !dto.ingredientsText?.trim()) {
      throw new BadRequestException(
        'Send either a recipe url or ingredientsText',
      );
    }
    return this.pantryAiService.planCooked(dto);
  }
}
