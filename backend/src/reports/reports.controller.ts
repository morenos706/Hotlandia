import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts/:contractId/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('pdf')
  async downloadPdf(
    @Param('contractId') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generateExecutionPdf(contractId, user.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="informe-${contractId}.pdf"`,
    });
    res.send(buffer);
  }

  @Get('excel')
  async downloadExcel(
    @Param('contractId') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generateExcelExport(contractId, user.id);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="contrato-${contractId}.xlsx"`,
    });
    res.send(buffer);
  }
}
