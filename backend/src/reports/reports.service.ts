import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { StorageService } from '../storage/storage.service';
import type { Semaphore } from '../execution/execution-calculator.service';

const IMAGE_MIME_PREFIX = 'image/';

const COLORS = {
  primary: '#0B3D91',
  primaryDark: '#082C68',
  green: '#1E8E3E',
  greenLight: '#E6F4EA',
  yellow: '#C8790A',
  yellowLight: '#FDF2E3',
  red: '#D93025',
  redLight: '#FCEAE9',
  text: '#1A1A1A',
  muted: '#6B7280',
  border: '#DADFE8',
  surface: '#F4F6FB',
  white: '#FFFFFF',
};

const SEMAPHORE_STYLE: Record<Semaphore, { fg: string; bg: string; label: string }> = {
  GREEN: { fg: COLORS.green, bg: COLORS.greenLight, label: 'En cumplimiento' },
  YELLOW: { fg: COLORS.yellow, bg: COLORS.yellowLight, label: 'Desviación moderada' },
  RED: { fg: COLORS.red, bg: COLORS.redLight, label: 'Desviación crítica' },
};

const SEVERITY_COLOR: Record<string, string> = {
  INFO: COLORS.primary,
  WARNING: COLORS.yellow,
  CRITICAL: COLORS.red,
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly storage: StorageService,
  ) {}

  async generateExecutionPdf(contractId: string, contractorId: string): Promise<Buffer> {
    const [contract, dashboardData, evidences, indicatorResults, payments, alerts] = await Promise.all([
      this.getContractOrThrow(contractId, contractorId),
      this.dashboard.getContractDashboard(contractId, contractorId),
      this.prisma.evidence.findMany({
        where: { contractId },
        include: { activity: true },
        orderBy: { uploadedAt: 'asc' },
      }),
      this.prisma.indicatorResult.findMany({
        where: { contractId },
        include: { indicator: true },
        orderBy: { calculatedAt: 'asc' },
      }),
      this.prisma.payment.findMany({ where: { contractId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.alert.findMany({
        where: { contractId, isResolved: false },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const isPhoto = (e: (typeof evidences)[number]) =>
      e.type === 'FOTOGRAFIA' && e.mimeType.startsWith(IMAGE_MIME_PREFIX);
    const photoEvidences = evidences.filter(isPhoto);
    const otherEvidences = evidences.filter((e) => !isPhoto(e));

    // Se descargan antes de construir el PDF: PDFDocument se arma de forma
    // síncrona dentro de la Promise, así que todo el trabajo asíncrono
    // (traer las fotos del storage) debe resolverse primero.
    const photos = await Promise.all(
      photoEvidences.map(async (evidence) => {
        try {
          return { evidence, buffer: await this.storage.download(evidence.storageKey) };
        } catch {
          return { evidence, buffer: null };
        }
      }),
    );

    return new Promise((resolve, reject) => {
      // bufferPages: true es necesario para poder recorrer todas las páginas
      // al final (addFooter) — sin esto, pdfkit descarta del buffer las
      // páginas ya emitidas apenas el documento supera un par de páginas.
      const doc = new PDFDocument({ margin: 50, size: 'LETTER', bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Portada
      drawCoverPage(doc, contract, dashboardData.execution.semaphore);
      doc.addPage();

      // 1. Información general
      sectionHeader(doc, '1. Información general');
      infoGrid(doc, [
        ['Número de contrato', contract.contractNumber],
        ['Modalidad', contract.modality],
        ['Vigencia', String(contract.vigencia)],
        ['Estado', contract.status],
        ['Fecha de inicio', formatDate(contract.startDate)],
        ['Fecha de terminación', formatDate(contract.endDate)],
      ]);

      // 2. Objeto contractual
      sectionHeader(doc, '2. Objeto contractual');
      textBox(doc, contract.purpose);

      // 3. Indicadores de ejecución
      sectionHeader(doc, '3. Indicadores de ejecución');
      const dev = Number(dashboardData.execution.deviation);
      const devColor = dev < 0 ? COLORS.red : COLORS.green;
      statCardsRow(doc, [
        {
          label: 'Ejecución física',
          value: `${dashboardData.execution.physicalPercentage}%`,
          opts: { color: COLORS.primary, percentage: Number(dashboardData.execution.physicalPercentage) },
        },
        {
          label: 'Ejecución financiera',
          value: `${dashboardData.execution.financialPercentage}%`,
          opts: { color: COLORS.primary, percentage: Number(dashboardData.execution.financialPercentage) },
        },
        {
          label: 'Ejecución temporal',
          value: `${dashboardData.execution.temporalPercentage}%`,
          opts: { color: COLORS.primary, percentage: Number(dashboardData.execution.temporalPercentage) },
        },
        {
          label: 'Desviación física-temporal',
          value: `${dev > 0 ? '+' : ''}${dev}%`,
          opts: { color: devColor },
        },
      ]);
      statCardsRow(doc, [
        { label: 'Valor actual del contrato', value: formatCurrency(contract.currentValue), opts: { small: true } },
        {
          label: 'Valor ejecutado',
          value: formatCurrency(dashboardData.execution.executedValue),
          opts: { small: true, color: COLORS.green },
        },
        { label: 'Saldo disponible', value: formatCurrency(dashboardData.execution.balance), opts: { small: true } },
      ]);
      semaphoreCard(doc, dashboardData.execution.semaphore, dev);

      // 4. Curva S
      sectionHeader(doc, '4. Curva S — Programado vs. ejecutado');
      drawSCurveChart(doc, dashboardData.sCurve);

      // 5. Obligaciones y actividades
      sectionHeader(doc, '5. Obligaciones y actividades');
      const obligationRows: string[][] = [];
      for (const obligation of contract.obligations) {
        if (obligation.activities.length === 0) {
          obligationRows.push([obligation.code, '—', '—', '—', `${obligation.weightPercentage}%`]);
        }
        for (const activity of obligation.activities) {
          obligationRows.push([
            obligation.code,
            truncate(`${activity.code} ${activity.name}`, 42),
            activity.status,
            `${activity.plannedQuantity} ${activity.unitOfMeasure}`,
            `${activity.weightPercentage}%`,
          ]);
        }
      }
      drawTable(
        doc,
        [
          { header: 'Obligación', width: 60 },
          { header: 'Actividad', width: 210 },
          { header: 'Estado', width: 80 },
          { header: 'Meta', width: 90, align: 'right' },
          { header: 'Peso', width: 72, align: 'right' },
        ],
        obligationRows,
        'No hay obligaciones registradas para este contrato.',
      );

      // 6. Alertas activas
      sectionHeader(doc, '6. Alertas activas');
      drawTable(
        doc,
        [
          { header: 'Severidad', width: 70 },
          { header: 'Tipo', width: 150 },
          { header: 'Mensaje', width: 212 },
          { header: 'Fecha', width: 80 },
        ],
        alerts.map((alert) => [
          alert.severity,
          alert.type.replace(/_/g, ' '),
          truncate(alert.message, 60),
          formatDate(alert.createdAt),
        ]),
        'No hay alertas activas para este contrato.',
        (rowIndex) => SEVERITY_COLOR[alerts[rowIndex]?.severity] ?? COLORS.primary,
      );

      // 7. Registro fotográfico
      doc.addPage();
      sectionHeader(doc, '7. Registro fotográfico');
      if (photos.length === 0) {
        emptyState(doc, 'No se cargaron fotografías como evidencia para este contrato.');
      } else {
        for (const { evidence, buffer } of photos) {
          if (doc.y > doc.page.height - 260) {
            doc.addPage();
          }
          if (buffer) {
            try {
              // Se calcula manualmente el tamaño y se avanza doc.y de forma
              // explícita: doc.image({ fit, align }) no siempre desplaza el
              // cursor en flujo, lo que hacía que el pie de foto quedara
              // superpuesto sobre la imagen en vez de debajo.
              const maxWidth = 320;
              const maxHeight = 220;
              // @types/pdfkit no declara openImage aunque existe en runtime
              // (usado internamente por doc.image()); se necesita aquí para
              // conocer el tamaño real antes de avanzar el cursor.
              const img = (
                doc as unknown as { openImage(src: Buffer): { width: number; height: number } }
              ).openImage(buffer);
              const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
              const renderWidth = img.width * scale;
              const renderHeight = img.height * scale;
              const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
              const x = doc.page.margins.left + (contentWidth - renderWidth) / 2;
              const y = doc.y;
              doc.roundedRect(x - 3, y - 3, renderWidth + 6, renderHeight + 6, 3).fill(COLORS.white);
              doc
                .roundedRect(x - 3, y - 3, renderWidth + 6, renderHeight + 6, 3)
                .lineWidth(1)
                .strokeColor(COLORS.border)
                .stroke();
              doc.image(buffer, x, y, { width: renderWidth, height: renderHeight });
              doc.y = y + renderHeight + 8;
            } catch {
              doc.fontSize(9).fillColor(COLORS.muted).text(`[No se pudo procesar la imagen: ${evidence.originalFileName}]`);
            }
          } else {
            doc.fontSize(9).fillColor(COLORS.muted).text(`[No se pudo recuperar la imagen: ${evidence.originalFileName}]`);
          }
          doc
            .fontSize(8)
            .fillColor(COLORS.muted)
            .text(
              [
                evidence.activity ? `${evidence.activity.code} — ${evidence.activity.name}` : 'Sin actividad asociada',
                evidence.description ?? null,
                formatDate(evidence.uploadedAt),
              ]
                .filter(Boolean)
                .join(' · '),
              { align: 'center' },
            );
          doc.fillColor(COLORS.text).moveDown();
        }
      }

      // 8. Otras evidencias y documentos
      doc.addPage();
      sectionHeader(doc, '8. Otras evidencias y documentos');
      drawTable(
        doc,
        [
          { header: 'Tipo', width: 80 },
          { header: 'Archivo', width: 190 },
          { header: 'Actividad', width: 150 },
          { header: 'Fecha', width: 92 },
        ],
        otherEvidences.map((evidence) => [
          evidence.type,
          truncate(evidence.originalFileName, 32),
          evidence.activity ? truncate(`${evidence.activity.code} ${evidence.activity.name}`, 26) : '—',
          formatDate(evidence.uploadedAt),
        ]),
        'No se registraron otros documentos de evidencia.',
      );

      // 9. Indicadores de gestión
      sectionHeader(doc, '9. Indicadores de gestión');
      drawTable(
        doc,
        [
          { header: 'Indicador', width: 190 },
          { header: 'Categoría', width: 100 },
          { header: 'Periodo', width: 110 },
          { header: 'Valor', width: 112, align: 'right' },
        ],
        indicatorResults.map((result) => [
          truncate(result.indicator.name, 34),
          result.indicator.category,
          result.periodLabel,
          `${result.value}${result.indicator.unit ? ` ${result.indicator.unit}` : ''}`,
        ]),
        'No se han registrado resultados de indicadores para este contrato.',
      );

      // 10. Resumen de pagos
      sectionHeader(doc, '10. Resumen de pagos');
      const totalPagado = payments
        .filter((p) => p.status === 'PAGADO')
        .reduce((acc, p) => acc + Number(p.value), 0);
      statCardsRow(doc, [
        { label: 'Total pagado', value: formatCurrency(totalPagado), opts: { small: true, color: COLORS.green } },
        { label: 'Pagos registrados', value: String(payments.length), opts: { small: true } },
        {
          label: 'Pendientes de pago',
          value: String(payments.filter((p) => p.status !== 'PAGADO' && p.status !== 'RECHAZADO').length),
          opts: { small: true, color: COLORS.yellow },
        },
      ]);
      drawTable(
        doc,
        [
          { header: 'Periodo', width: 90 },
          { header: 'Factura', width: 80 },
          { header: 'Egreso', width: 100 },
          { header: 'Valor', width: 110, align: 'right' },
          { header: 'Estado', width: 132 },
        ],
        payments.map((payment) => [
          payment.periodLabel,
          payment.invoiceNumber ?? '—',
          payment.disbursementNumber ?? '—',
          formatCurrency(payment.value),
          payment.status,
        ]),
        'No se han registrado pagos para este contrato.',
      );

      // 11. Observaciones
      sectionHeader(doc, '11. Observaciones');
      textBox(doc, contract.observations ?? 'Sin observaciones registradas.');

      addFooter(doc);
      doc.end();
    });
  }

  async generateExcelExport(contractId: string, contractorId: string): Promise<Buffer> {
    const contract = await this.getContractOrThrow(contractId, contractorId);
    const workbook = new Workbook();
    workbook.creator = 'CONTRACTUS 360';
    workbook.created = new Date();

    const contractSheet = workbook.addWorksheet('Contrato');
    contractSheet.columns = [
      { header: 'Campo', key: 'field', width: 28 },
      { header: 'Valor', key: 'value', width: 50 },
    ];
    contractSheet.addRows([
      { field: 'Número de contrato', value: contract.contractNumber },
      { field: 'Objeto', value: contract.purpose },
      { field: 'Estado', value: contract.status },
      { field: 'Valor inicial', value: contract.initialValue.toString() },
      { field: 'Valor actual', value: contract.currentValue.toString() },
      { field: 'Fecha de inicio', value: formatDate(contract.startDate) },
      { field: 'Fecha de terminación', value: formatDate(contract.endDate) },
    ]);

    const obligationsSheet = workbook.addWorksheet('Obligaciones');
    obligationsSheet.columns = [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Descripción', key: 'description', width: 50 },
      { header: 'Peso (%)', key: 'weight', width: 12 },
    ];
    for (const obligation of contract.obligations) {
      obligationsSheet.addRow({
        code: obligation.code,
        description: obligation.description,
        weight: obligation.weightPercentage.toString(),
      });
    }

    const activitiesSheet = workbook.addWorksheet('Actividades');
    activitiesSheet.columns = [
      { header: 'Obligación', key: 'obligation', width: 12 },
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Nombre', key: 'name', width: 40 },
      { header: 'Meta', key: 'goal', width: 15 },
      { header: 'Unidad', key: 'unit', width: 10 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Valor asignado', key: 'value', width: 18 },
    ];
    for (const obligation of contract.obligations) {
      for (const activity of obligation.activities) {
        activitiesSheet.addRow({
          obligation: obligation.code,
          code: activity.code,
          name: activity.name,
          goal: activity.plannedQuantity.toString(),
          unit: activity.unitOfMeasure,
          status: activity.status,
          value: activity.assignedValue.toString(),
        });
      }
    }

    const executionRecords = await this.prisma.executionRecord.findMany({
      where: { activity: { obligation: { contractId } } },
      include: { activity: true, period: true },
      orderBy: { executionDate: 'asc' },
    });
    const executionSheet = workbook.addWorksheet('Ejecución');
    executionSheet.columns = [
      { header: 'Periodo', key: 'period', width: 20 },
      { header: 'Actividad', key: 'activity', width: 30 },
      { header: 'Fecha', key: 'date', width: 15 },
      { header: 'Cantidad ejecutada', key: 'quantity', width: 18 },
      { header: 'Valor ejecutado', key: 'value', width: 18 },
      { header: '% físico', key: 'pct', width: 10 },
    ];
    for (const record of executionRecords) {
      executionSheet.addRow({
        period: record.period.label,
        activity: `${record.activity.code} - ${record.activity.name}`,
        date: formatDate(record.executionDate),
        quantity: record.executedQuantity.toString(),
        value: record.executedValue.toString(),
        pct: record.physicalPercentage.toString(),
      });
    }

    const payments = await this.prisma.payment.findMany({ where: { contractId } });
    const paymentsSheet = workbook.addWorksheet('Pagos');
    paymentsSheet.columns = [
      { header: 'Periodo', key: 'period', width: 20 },
      { header: 'Factura', key: 'invoice', width: 18 },
      { header: 'Número de egreso', key: 'disbursement', width: 20 },
      { header: 'Valor', key: 'value', width: 18 },
      { header: 'Estado', key: 'status', width: 15 },
    ];
    for (const payment of payments) {
      paymentsSheet.addRow({
        period: payment.periodLabel,
        invoice: payment.invoiceNumber ?? '',
        disbursement: payment.disbursementNumber ?? '',
        value: payment.value.toString(),
        status: payment.status,
      });
    }

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  private async getContractOrThrow(contractId: string, contractorId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, contractorId, deletedAt: null },
      include: {
        obligations: { where: { deletedAt: null }, include: { activities: { where: { deletedAt: null } } } },
      },
    });
    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }
    return contract;
  }
}

// ---------------------------------------------------------------------------
// Helpers de dibujo del PDF
// ---------------------------------------------------------------------------

/**
 * Fuerza un salto de página propio si el bloque que se va a dibujar
 * (altura `height`) no cabe en el espacio restante de la página actual.
 *
 * Es necesario porque pdfkit dispara su propia paginación automática
 * dentro de `.text()` comparando el `y` explícito contra el margen
 * inferior de la página — si ese `y` cae a pocos puntos del margen (como
 * pasaba con la leyenda de la curva S), cada llamada de texto cercana al
 * borde puede insertar una página nueva por su cuenta, en cascada. Al
 * reservar el espacio nosotros mismos con margen de sobra antes de
 * dibujar, ningún elemento termina nunca tan cerca del borde como para
 * disparar esa paginación sorpresiva.
 */
function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  const maxY = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > maxY) {
    doc.addPage();
  }
}

function drawCoverPage(
  doc: PDFKit.PDFDocument,
  contract: { contractNumber: string; vigencia: number; status: string },
  semaphore: Semaphore,
) {
  const pageWidth = doc.page.width;
  const bandHeight = 190;

  doc.rect(0, 0, pageWidth, bandHeight).fill(COLORS.primary);
  doc.rect(0, bandHeight - 6, pageWidth, 6).fill(COLORS.primaryDark);

  doc
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(30)
    .text('CONTRACTUS 360', 0, 55, { align: 'center', width: pageWidth });
  doc
    .font('Helvetica')
    .fontSize(12)
    .text('Sistema de Gestión y Seguimiento Contractual', 0, 96, { align: 'center', width: pageWidth });
  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .text('INFORME DE EJECUCIÓN CONTRACTUAL', 0, 135, { align: 'center', width: pageWidth });

  doc.fillColor(COLORS.text).font('Helvetica');

  const boxX = doc.page.margins.left;
  const boxY = bandHeight + 40;
  const boxWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;
  const boxHeight = 130;

  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 6).lineWidth(1).strokeColor(COLORS.border).stroke();

  doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica-Bold').text('NÚMERO DE CONTRATO', boxX + 20, boxY + 20);
  doc.fontSize(20).fillColor(COLORS.primary).text(contract.contractNumber, boxX + 20, boxY + 34);

  doc.fontSize(9).fillColor(COLORS.muted).text('VIGENCIA', boxX + 20, boxY + 70);
  doc.fontSize(12).fillColor(COLORS.text).font('Helvetica').text(String(contract.vigencia), boxX + 20, boxY + 83);

  doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica-Bold').text('ESTADO', boxX + 170, boxY + 70);
  doc.fontSize(12).fillColor(COLORS.text).font('Helvetica').text(contract.status, boxX + 170, boxY + 83);

  const s = SEMAPHORE_STYLE[semaphore];
  doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica-Bold').text('SEMÁFORO', boxX + 320, boxY + 70);
  doc.circle(boxX + 326, boxY + 90, 5).fill(s.fg);
  doc
    .fontSize(11)
    .fillColor(s.fg)
    .font('Helvetica-Bold')
    .text(s.label, boxX + 338, boxY + 85, { width: boxWidth - 358 });
  doc.font('Helvetica').fillColor(COLORS.text);

  doc
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(`Generado el ${formatDateTime(new Date())}`, boxX, boxY + boxHeight - 24, {
      width: boxWidth,
      align: 'center',
    });

  // Igual que en addFooter: por debajo de page.maxY(), así que se evita
  // `width` (dispara paginación automática incluso con lineBreak:false)
  // y se centra a mano con widthOfString.
  const coverFooterText = 'Herramienta de gestión interna — no reemplaza SECOP II';
  doc.fontSize(8).fillColor(COLORS.muted);
  const coverFooterWidth = doc.widthOfString(coverFooterText);
  doc.text(coverFooterText, (pageWidth - coverFooterWidth) / 2, doc.page.height - 60, { lineBreak: false });
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
  // 22 del título + 12 de espacio + ~40 para que no quede huérfano al pie de página.
  ensureSpace(doc, 74);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  const height = 22;
  doc.rect(x, y, width, height).fill(COLORS.primary);
  doc
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .text(title.toUpperCase(), x + 10, y + 6.5, { width: width - 20 });
  doc.font('Helvetica').fillColor(COLORS.text);
  doc.y = y + height + 12;
}

function infoGrid(doc: PDFKit.PDFDocument, pairs: Array<[string, string]>) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = width / 2;
  const rowHeight = 30;
  const rows = Math.ceil(pairs.length / 2);
  const boxHeight = rows * rowHeight + 12;
  ensureSpace(doc, boxHeight + 14);
  const y = doc.y;

  doc.rect(x, y, width, boxHeight).fill(COLORS.surface);
  doc.rect(x, y, width, boxHeight).lineWidth(1).strokeColor(COLORS.border).stroke();

  pairs.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const px = x + 16 + col * colWidth;
    const py = y + 8 + row * rowHeight;
    doc.fontSize(7.5).fillColor(COLORS.muted).font('Helvetica-Bold').text(label.toUpperCase(), px, py, { width: colWidth - 28 });
    doc.fontSize(10).fillColor(COLORS.text).font('Helvetica').text(value, px, py + 11, { width: colWidth - 28 });
  });

  doc.y = y + boxHeight + 14;
}

function textBox(doc: PDFKit.PDFDocument, text: string) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fontSize(10);
  const textHeight = doc.heightOfString(text, { width: width - 24, align: 'justify' });
  const boxHeight = textHeight + 24;
  ensureSpace(doc, boxHeight + 14);
  const y = doc.y;

  doc.rect(x, y, width, boxHeight).fill(COLORS.surface);
  doc.rect(x, y, 4, boxHeight).fill(COLORS.primary);
  doc.rect(x, y, width, boxHeight).lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.fillColor(COLORS.text).font('Helvetica').text(text, x + 16, y + 12, { width: width - 32, align: 'justify' });

  doc.y = y + boxHeight + 14;
}

interface StatCardOptions {
  color?: string;
  percentage?: number;
  small?: boolean;
}

function statCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  opts: StatCardOptions = {},
) {
  doc.roundedRect(x, y, width, height, 4).lineWidth(1).strokeColor(COLORS.border).stroke();
  doc
    .fontSize(7)
    .fillColor(COLORS.muted)
    .font('Helvetica-Bold')
    .text(label.toUpperCase(), x + 10, y + 9, { width: width - 20 });
  doc
    .fontSize(opts.small ? 13 : 18)
    .fillColor(opts.color ?? COLORS.text)
    .font('Helvetica-Bold')
    .text(value, x + 10, y + 21, { width: width - 20 });
  doc.font('Helvetica').fillColor(COLORS.text);

  if (opts.percentage !== undefined) {
    const barY = y + height - 14;
    const barWidth = width - 20;
    const barX = x + 10;
    doc.roundedRect(barX, barY, barWidth, 5, 2.5).fill(COLORS.surface);
    const filledWidth = (Math.max(0, Math.min(100, opts.percentage)) / 100) * barWidth;
    if (filledWidth > 1) {
      doc.roundedRect(barX, barY, filledWidth, 5, 2.5).fill(opts.color ?? COLORS.primary);
    }
  }
}

function statCardsRow(
  doc: PDFKit.PDFDocument,
  cards: Array<{ label: string; value: string; opts?: StatCardOptions }>,
  height = 62,
) {
  ensureSpace(doc, height + 14);
  const x0 = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 10;
  const cardWidth = (contentWidth - gap * (cards.length - 1)) / cards.length;
  const y = doc.y;
  cards.forEach((card, i) => {
    const x = x0 + i * (cardWidth + gap);
    statCard(doc, x, y, cardWidth, height, card.label, card.value, card.opts);
  });
  doc.y = y + height + 14;
}

function semaphoreCard(doc: PDFKit.PDFDocument, semaphore: Semaphore, deviation: number) {
  const s = SEMAPHORE_STYLE[semaphore];
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 44;
  ensureSpace(doc, height + 14);
  const y = doc.y;

  doc.rect(x, y, width, height).fill(s.bg);
  doc.rect(x, y, 4, height).fill(s.fg);
  doc.rect(x, y, width, height).lineWidth(1).strokeColor(s.fg).stroke();

  doc.circle(x + 24, y + height / 2, 7).fill(s.fg);
  doc
    .fontSize(12)
    .fillColor(s.fg)
    .font('Helvetica-Bold')
    .text(s.label, x + 42, y + 11, { width: width - 260 });
  doc
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .text(
      `Desviación entre ejecución física y tiempo transcurrido: ${deviation > 0 ? '+' : ''}${deviation}%`,
      x + 42,
      y + 27,
      { width: width - 260 },
    );

  doc.font('Helvetica').fillColor(COLORS.text);
  doc.y = y + height + 14;
}

function drawSCurveChart(
  doc: PDFKit.PDFDocument,
  points: Array<{ periodLabel: string; plannedPercentage: unknown; executedPercentage: unknown }>,
) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 160;
  // +40 cubre la leyenda que se dibuja debajo del recuadro del gráfico.
  ensureSpace(doc, height + 40);
  const y = doc.y;
  const paddingLeft = 34;
  const paddingBottom = 20;
  const chartX = x + paddingLeft;
  const chartTop = y + 8;
  const chartWidth = width - paddingLeft - 8;
  const chartHeight = height - paddingBottom - 16;

  doc.roundedRect(x, y, width, height, 4).fill(COLORS.surface);
  doc.roundedRect(x, y, width, height, 4).lineWidth(1).strokeColor(COLORS.border).stroke();

  for (let pct = 0; pct <= 100; pct += 25) {
    const gy = chartTop + chartHeight - (pct / 100) * chartHeight;
    doc.moveTo(chartX, gy).lineTo(chartX + chartWidth, gy).lineWidth(0.5).strokeColor(COLORS.border).stroke();
    doc
      .fontSize(6.5)
      .fillColor(COLORS.muted)
      .text(`${pct}%`, x + 2, gy - 3, { width: paddingLeft - 6, align: 'right' });
  }

  if (points.length === 0) {
    doc
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(
        'Aún no hay periodos de ejecución cerrados para graficar la curva S.',
        chartX,
        chartTop + chartHeight / 2 - 5,
        { width: chartWidth, align: 'center' },
      );
  } else {
    const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0;

    const plot = (key: 'plannedPercentage' | 'executedPercentage', color: string) => {
      doc.lineWidth(1.5).strokeColor(color);
      points.forEach((p, i) => {
        const px = chartX + i * stepX;
        const py = chartTop + chartHeight - (Number(p[key]) / 100) * chartHeight;
        if (i === 0) doc.moveTo(px, py);
        else doc.lineTo(px, py);
      });
      doc.stroke();
      points.forEach((p, i) => {
        const px = chartX + i * stepX;
        const py = chartTop + chartHeight - (Number(p[key]) / 100) * chartHeight;
        doc.circle(px, py, 2.3).fill(color);
      });
    };

    plot('plannedPercentage', COLORS.primary);
    plot('executedPercentage', COLORS.green);

    doc.fontSize(6).fillColor(COLORS.muted);
    points.forEach((p, i) => {
      const px = chartX + i * stepX;
      doc.text(p.periodLabel, px - 22, chartTop + chartHeight + 5, { width: 44, align: 'center' });
    });
  }

  const legendY = y + height + 6;
  doc.rect(x, legendY, 8, 8).fill(COLORS.primary);
  doc.fontSize(8).fillColor(COLORS.text).text('Programado', x + 12, legendY - 1);
  doc.rect(x + 92, legendY, 8, 8).fill(COLORS.green);
  doc.text('Ejecutado', x + 104, legendY - 1);

  doc.y = legendY + 20;
}

interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: string[][],
  emptyMessage: string,
  rowAccentColor?: (rowIndex: number) => string,
) {
  const x = doc.page.margins.left;
  const rowHeight = 20;
  const tableWidth = columns.reduce((a, c) => a + c.width, 0);

  const drawHeader = (headerY: number) => {
    doc.rect(x, headerY, tableWidth, rowHeight).fill(COLORS.primary);
    let cx = x;
    doc.fontSize(7.5).fillColor(COLORS.white).font('Helvetica-Bold');
    for (const col of columns) {
      doc.text(col.header, cx + 6, headerY + 6, { width: col.width - 12, align: col.align ?? 'left' });
      cx += col.width;
    }
    doc.font('Helvetica').fillColor(COLORS.text);
    return headerY + rowHeight;
  };

  // Reserva espacio para el encabezado + al menos una fila, para no dejar
  // el encabezado de la tabla huérfano justo al pie de la página.
  ensureSpace(doc, rowHeight * 2);
  let y = drawHeader(doc.y);

  if (rows.length === 0) {
    doc.rect(x, y, tableWidth, rowHeight).fill(COLORS.surface);
    doc.rect(x, y, tableWidth, rowHeight).lineWidth(0.5).strokeColor(COLORS.border).stroke();
    doc.fontSize(8.5).fillColor(COLORS.muted).text(emptyMessage, x + 8, y + 6, { width: tableWidth - 16 });
    doc.y = y + rowHeight + 12;
    return;
  }

  rows.forEach((row, i) => {
    if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
      y = drawHeader(doc.page.margins.top);
    }

    const bg = i % 2 === 0 ? COLORS.white : COLORS.surface;
    doc.rect(x, y, tableWidth, rowHeight).fill(bg);
    if (rowAccentColor) {
      doc.rect(x, y, 3, rowHeight).fill(rowAccentColor(i));
    }
    doc.rect(x, y, tableWidth, rowHeight).lineWidth(0.5).strokeColor(COLORS.border).stroke();

    let cx = x;
    doc.fontSize(7.5).fillColor(COLORS.text);
    row.forEach((cell, ci) => {
      doc.text(cell, cx + 6, y + 6, { width: columns[ci].width - 12, align: columns[ci].align ?? 'left' });
      cx += columns[ci].width;
    });
    y += rowHeight;
  });

  doc.y = y + 12;
}

function emptyState(doc: PDFKit.PDFDocument, message: string) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 32;
  ensureSpace(doc, height + 12);
  const y = doc.y;
  doc.rect(x, y, width, height).fill(COLORS.surface);
  doc.rect(x, y, width, height).lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.fontSize(9).fillColor(COLORS.muted).text(message, x + 12, y + 11, { width: width - 24 });
  doc.y = y + height + 12;
}

function addFooter(doc: PDFKit.PDFDocument) {
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 42;
    doc
      .moveTo(50, y)
      .lineTo(doc.page.width - 50, y)
      .lineWidth(0.75)
      .strokeColor(COLORS.border)
      .stroke();

    const text = `CONTRACTUS 360 — Herramienta de gestión interna, no reemplaza SECOP II — Página ${i + 1} de ${pageCount}`;
    doc.fontSize(7.5).fillColor(COLORS.muted);
    // El pie vive deliberadamente por debajo de page.maxY() (dentro del
    // margen inferior). Cualquier .text() con `width` —explícito o el que
    // pdfkit calcula por defecto— pasa por su chequeo interno de
    // paginación automática (compara doc.y contra ese mismo maxY), así
    // que insertaba una página en blanco extra por cada página del
    // informe. `lineBreak: false` sin `width` evita esa ruta; el
    // centrado se calcula a mano.
    const textWidth = doc.widthOfString(text);
    const textX = (doc.page.width - textWidth) / 2;
    doc.text(text, textX, y + 8, { lineBreak: false });
  }
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function formatCurrency(value: unknown): string {
  const numeric = Number(value);
  return numeric.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}
