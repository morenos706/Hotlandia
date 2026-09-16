import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateContractDto {
  @ApiProperty()
  @IsString()
  contractNumber: string;

  @ApiProperty()
  @IsInt()
  vigencia: number;

  @ApiProperty({ enum: ContractType })
  @IsEnum(ContractType)
  contractType: ContractType;

  @ApiProperty()
  @IsString()
  modality: string;

  @ApiProperty()
  @IsString()
  purpose: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalRepresentative?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dependency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  project?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fundingSource?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  budgetLine?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cdp?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rp?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  secopId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  secopUrl?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  initialValue: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  termDays: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  observations?: string;
}
