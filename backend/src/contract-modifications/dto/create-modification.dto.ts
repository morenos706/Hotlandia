import { ApiProperty } from '@nestjs/swagger';
import { ModificationType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateModificationDto {
  @ApiProperty({ enum: ModificationType })
  @IsEnum(ModificationType)
  type: ModificationType;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ required: false, description: 'Positivo para adición, negativo para reducción' })
  @IsOptional()
  @IsNumber()
  valueDelta?: number;

  @ApiProperty({ required: false, description: 'Días de prórroga (positivo) o suspensión' })
  @IsOptional()
  @IsInt()
  daysDelta?: number;

  @ApiProperty()
  @IsDateString()
  effectiveDate: string;
}
