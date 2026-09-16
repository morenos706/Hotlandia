import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  async generateExecutionPdf(contractId: string, contractorId: string): Promise<Buffer> {
    const [contract, dashboardData] = await Promise.all([
      this.getContractOrThrow(contractId, contractorId),
      this.dashboard.getContractDashboard(contractId, contractorId),
    ]);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // 1. Portada
      doc.fontSize(20).fillColor('#0B3D91').text('CONTRACTUS 360', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(14).fillColor('#000').text('Informe de Ejecución Contractual', { align: 'center' });
      doc.moveDown(2);

      // 2. Información general
      section(doc, '1. Información general');
      keyValue(doc, 'Número de contrato', contract.contractNumber);
      keyValue(doc, 'Vigencia', String(contract.vigencia));
      keyValue(doc, 'Modalidad', contract.modality);
      keyValue(doc, 'Estado', contract.status);
      keyValue(doc, 'Fecha de inicio', formatDate(contract.startDate));
      keyValue(doc, 'Fecha de terminación', formatDate(contract.endDate));
      doc.moveDown();

      // 3. Objeto contractual
      section(doc, '2. Objeto contractual');
      doc.fontSize(10).text(contract.purpose, { align: 'justify' });
      doc.moveDown();

      // 4. Ejecución física, financiera y temporal
      section(doc, '3. Ejecución física, financiera y temporal');
      keyValue(doc, 'Ejecución física', `${dashboardData.execution.physicalPercentage}%`);
      keyValue(doc, 'Ejecución financiera', `${dashboardData.execution.financialPercentage}%`);
      keyValue(doc, 'Ejecución temporal', `${dashboardData.execution.temporalPercentage}%`);
      keyValue(doc, 'Desviación (física - temporal)', `${dashboardData.execution.deviation}%`);
      keyValue(doc, 'Semáforo', dashboardData.execution.semaphore);
      keyValue(doc, 'Valor actual del contrato', formatCurrency(contract.currentValue));
      keyValue(doc, 'Valor ejecutado', formatCurrency(dashboardData.execution.executedValue));
      keyValue(doc, 'Saldo', formatCurrency(dashboardData.execution.balance));
      doc.moveDown();

      // 5. Obligaciones y actividades
      section(doc, '4. Obligaciones y actividades');
      for (const obligation of contract.obligations) {
        doc.fontSize(11).fillColor('#0B3D91').text(`${obligation.code} — ${obligation.description}`);
        for (const activity of obligation.activities) {
          doc
            .fontSize(9)
            .fillColor('#000')
            .text(
              `   • ${activity.code} ${activity.name} — Estado: ${activity.status} — Meta: ${activity.plannedQuantity} ${activity.unitOfMeasure}`,
            );
        }
        doc.moveDown(0.3);
      }
      doc.moveDown();

      // 6. Alertas
      section(doc, '5. Alertas activas');
      doc.fontSize(10).text(`Alertas sin resolver: ${dashboardData.unresolvedAlerts}`);
      doc.moveDown();

      // 7. Observaciones
      section(doc, '6. Observaciones');
      doc.fontSize(10).text(contract.observations ?? 'Sin observaciones registradas.');

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
      { header: 'Valor', key: 'value', width: 18 },
      { header: 'Estado', key: 'status', width: 15 },
    ];
    for (const payment of payments) {
      paymentsSheet.addRow({
        period: payment.periodLabel,
        invoice: payment.invoiceNumber ?? '',
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

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.fontSize(13).fillColor('#0B3D91').text(title);
  doc.moveDown(0.3);
  doc.fillColor('#000');
}

function keyValue(doc: PDFKit.PDFDocument, key: string, value: string) {
  doc.fontSize(10).fillColor('#555').text(`${key}: `, { continued: true }).fillColor('#000').text(value);
}

function addFooter(doc: PDFKit.PDFDocument) {
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor('#999')
      .text(
        `CONTRACTUS 360 — Herramienta de gestión interna, no reemplaza SECOP II — Página ${i + 1} de ${pageCount}`,
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 },
      );
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: unknown): string {
  const numeric = Number(value);
  return numeric.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}
