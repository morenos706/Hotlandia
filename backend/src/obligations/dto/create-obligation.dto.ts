import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateObligationDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ description: 'Peso porcentual dentro del contrato (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercentage: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  indicator?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  observations?: string;
}
