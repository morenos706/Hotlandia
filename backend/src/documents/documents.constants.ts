export const DOCUMENT_FOLDERS = [
  'ESTUDIOS_PREVIOS',
  'CDP',
  'RP',
  'GARANTIAS',
  'ACTAS',
  'INFORMES',
  'EVIDENCIAS',
  'FOTOGRAFIAS',
  'FACTURAS',
  'PAGOS',
  'MODIFICACIONES',
  'SUPERVISION',
  'LIQUIDACION',
] as const;

export type DocumentFolder = (typeof DOCUMENT_FOLDERS)[number];

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;
