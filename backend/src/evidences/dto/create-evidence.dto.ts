import { ApiProperty } from '@nestjs/swagger';
import { EvidenceType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEvidenceDto {
  @ApiProperty({ enum: EvidenceType })
  @IsEnum(EvidenceType)
  type: EvidenceType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  executionRecordId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  capturedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  observations?: string;
}
