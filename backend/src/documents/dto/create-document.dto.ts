import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { DOCUMENT_FOLDERS, DocumentFolder } from '../documents.constants';

export class CreateDocumentDto {
  @ApiProperty({ enum: DOCUMENT_FOLDERS })
  @IsIn(DOCUMENT_FOLDERS)
  folder: DocumentFolder;

  @ApiProperty()
  @IsString()
  name: string;
}
