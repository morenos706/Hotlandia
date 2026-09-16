import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { IndicatorsService } from './indicators.service';
import { CreateIndicatorDto } from './dto/create-indicator.dto';
import { RecordIndicatorResultDto } from './dto/record-indicator-result.dto';

@ApiTags('indicators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class IndicatorsController {
  constructor(private readonly service: IndicatorsService) {}

  @Get('indicators')
  listCatalog() {
    return this.service.listCatalog();
  }

  @Post('indicators')
  createDefinition(@Body() dto: CreateIndicatorDto) {
    return this.service.createDefinition(dto);
  }

  @Get('contracts/:contractId/indicator-results')
  listResults(@Param('contractId') contractId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listResults(contractId, user.id);
  }

  @Post('contracts/:contractId/indicators/:indicatorId/results')
  recordResult(
    @Param('contractId') contractId: string,
    @Param('indicatorId') indicatorId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordIndicatorResultDto,
  ) {
    return this.service.recordResult(contractId, indicatorId, user.id, dto);
  }
}
