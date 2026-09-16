import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateExecutionRecordDto {
  @ApiProperty()
  @IsUUID()
  periodId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  executedQuantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  executedValue: number;

  @ApiProperty()
  @IsDateString()
  executionDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  result?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  observations?: string;
}
