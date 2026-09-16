import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ExecutionPeriodsService } from './execution-periods.service';
import { ExecutionRecordsService } from './execution-records.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { CreateExecutionRecordDto } from './dto/create-execution-record.dto';

@ApiTags('execution')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExecutionController {
  constructor(
    private readonly periods: ExecutionPeriodsService,
    private readonly records: ExecutionRecordsService,
  ) {}

  @Get('contracts/:contractId/execution-periods')
  listPeriods(@Param('contractId') contractId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.periods.list(contractId, user.id);
  }

  @Post('contracts/:contractId/execution-periods')
  createPeriod(
    @Param('contractId') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePeriodDto,
  ) {
    return this.periods.create(contractId, user.id, dto);
  }

  @Get('activities/:activityId/execution')
  listRecords(@Param('activityId') activityId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.records.list(activityId, user.id);
  }

  @Post('activities/:activityId/execution')
  createRecord(
    @Param('activityId') activityId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExecutionRecordDto,
  ) {
    return this.records.create(activityId, user.id, dto);
  }
}
