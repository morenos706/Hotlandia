import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { EvidencesService } from './evidences.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { MAX_EVIDENCE_SIZE_BYTES } from './evidences.constants';

@ApiTags('evidences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class EvidencesController {
  constructor(private readonly service: EvidencesService) {}

  @Get('contracts/:contractId/evidences')
  list(@Param('contractId') contractId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(contractId, user.id);
  }

  @Get('activities/:activityId/evidences')
  listByActivity(@Param('activityId') activityId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listByActivity(activityId, user.id);
  }

  @Get('evidences/:id/url')
  getUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getSignedUrl(id, user.id);
  }

  @Post('contracts/:contractId/evidences')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_EVIDENCE_SIZE_BYTES } }))
  upload(
    @Param('contractId') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEvidenceDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upload(contractId, user.id, dto, file);
  }
}
