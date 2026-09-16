import { Module } from '@nestjs/common';
import { ExecutionCalculatorService } from './execution-calculator.service';
import { ExecutionPeriodsService } from './execution-periods.service';
import { ExecutionRecordsService } from './execution-records.service';
import { ExecutionController } from './execution.controller';

@Module({
  controllers: [ExecutionController],
  providers: [ExecutionCalculatorService, ExecutionPeriodsService, ExecutionRecordsService],
  exports: [ExecutionCalculatorService, ExecutionPeriodsService, ExecutionRecordsService],
})
export class ExecutionModule {}
