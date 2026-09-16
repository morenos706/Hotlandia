import { ApiProperty } from '@nestjs/swagger';
import { IndicatorCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateIndicatorDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: IndicatorCategory })
  @IsEnum(IndicatorCategory)
  category: IndicatorCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ required: false, description: 'Descripción de cómo se calcula (documental, no ejecutable)' })
  @IsOptional()
  @IsString()
  formulaHint?: string;
}
