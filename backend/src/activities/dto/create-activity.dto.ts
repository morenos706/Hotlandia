import { ApiProperty } from '@nestjs/swagger';
import { Periodicity } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateActivityDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiProperty()
  @IsString()
  unitOfMeasure: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  plannedQuantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  assignedValue: number;

  @ApiProperty({ description: 'Peso porcentual dentro de la obligación (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercentage: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ enum: Periodicity, required: false })
  @IsOptional()
  @IsEnum(Periodicity)
  periodicity?: Periodicity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  expectedResult?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  requiresEvidence?: boolean;
}
