import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class RecordIndicatorResultDto {
  @ApiProperty()
  @IsString()
  periodLabel: string;

  @ApiProperty()
  @IsNumber()
  value: number;
}
