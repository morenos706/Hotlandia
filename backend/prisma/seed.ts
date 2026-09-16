import { PrismaClient, ModificationType, Periodicity } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  const contratista = await prisma.user.upsert({
    where: { email: 'contratista.demo@contractus360.local' },
    update: {},
    create: {
      email: 'contratista.demo@contractus360.local',
      passwordHash,
      fullName: 'Contratista Demo',
      identification: '1.020.304.050',
      phone: '3001234567',
    },
  });

  const contract = await prisma.contract.upsert({
    where: { contractNumber: 'SGM-CD-074-2026' },
    update: {},
    create: {
      contractNumber: 'SGM-CD-074-2026',
      vigencia: 2026,
      contractType: 'PRESTACION_SERVICIOS',
      modality: 'Contratación directa',
      purpose:
        'Prestar servicios profesionales para el apoyo técnico y administrativo en el seguimiento a los proyectos de infraestructura del Municipio Demo, en el marco del plan de desarrollo vigente.',
      contractorId: contratista.id,
      legalRepresentative: 'Alcalde Municipio Demo',
      dependency: 'Secretaría de Infraestructura',
      project: 'Fortalecimiento institucional 2026',
      fundingSource: 'Recursos propios',
      budgetLine: '2.3.1.02',
      cdp: 'CDP-2026-000074',
      rp: 'RP-2026-000074',
      secopId: 'CO1.REQ.0000000',
      secopUrl: 'https://community.secop.gov.co/',
      initialValue: 1_000_000_000,
      currentValue: 1_000_000_000,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-12-15'),
      originalEndDate: new Date('2026-12-15'),
      termDays: 334,
      status: 'EN_EJECUCION',
      observations: 'Contrato de demostración generado por el seed de CONTRACTUS 360.',
    },
  });

  await prisma.contractModification.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      contractId: contract.id,
      type: ModificationType.OTROSI,
      description: 'Otrosí No. 1: aclaración del alcance del objeto contractual.',
      previousValue: contract.initialValue,
      newValue: contract.currentValue,
      previousEndDate: contract.endDate,
      newEndDate: contract.endDate,
      effectiveDate: new Date('2026-03-01'),
    },
  });

  const obligation1 = await prisma.obligation.upsert({
    where: { contractId_code: { contractId: contract.id, code: 'OB-01' } },
    update: {},
    create: {
      contractId: contract.id,
      code: 'OB-01',
      description: 'Apoyar técnicamente el seguimiento a los proyectos de infraestructura vial del municipio.',
      type: 'TECNICA',
      weightPercentage: 60,
      goal: '12 informes de seguimiento',
      indicator: 'Número de informes entregados',
      unitOfMeasure: 'Informe',
    },
  });

  const obligation2 = await prisma.obligation.upsert({
    where: { contractId_code: { contractId: contract.id, code: 'OB-02' } },
    update: {},
    create: {
      contractId: contract.id,
      code: 'OB-02',
      description: 'Apoyar administrativamente la gestión documental del proyecto.',
      type: 'ADMINISTRATIVA',
      weightPercentage: 40,
      goal: '100% de expedientes organizados',
      indicator: 'Porcentaje de expedientes organizados',
      unitOfMeasure: 'Porcentaje',
    },
  });

  const activity1 = await prisma.activity.upsert({
    where: { obligationId_code: { obligationId: obligation1.id, code: 'ACT-01' } },
    update: {},
    create: {
      obligationId: obligation1.id,
      code: 'ACT-01',
      name: 'Visitas técnicas de seguimiento a obra',
      description: 'Realizar visitas técnicas mensuales a los frentes de obra activos.',
      goal: '12 visitas',
      unitOfMeasure: 'Visita',
      plannedQuantity: 12,
      assignedValue: 400_000_000,
      weightPercentage: 70,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-12-15'),
      periodicity: Periodicity.MENSUAL,
      responsibleId: contratista.id,
      expectedResult: 'Informe fotográfico y técnico de cada visita',
    },
  });

  const activity2 = await prisma.activity.upsert({
    where: { obligationId_code: { obligationId: obligation1.id, code: 'ACT-02' } },
    update: {},
    create: {
      obligationId: obligation1.id,
      code: 'ACT-02',
      name: 'Elaboración de informes de seguimiento',
      description: 'Consolidar la información recolectada en informes mensuales.',
      goal: '12 informes',
      unitOfMeasure: 'Informe',
      plannedQuantity: 12,
      assignedValue: 200_000_000,
      weightPercentage: 30,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-12-15'),
      periodicity: Periodicity.MENSUAL,
      responsibleId: contratista.id,
    },
  });

  const activity3 = await prisma.activity.upsert({
    where: { obligationId_code: { obligationId: obligation2.id, code: 'ACT-03' } },
    update: {},
    create: {
      obligationId: obligation2.id,
      code: 'ACT-03',
      name: 'Organización de expedientes contractuales',
      description: 'Digitalizar y organizar los expedientes del proyecto.',
      goal: '100',
      unitOfMeasure: 'Porcentaje',
      plannedQuantity: 100,
      assignedValue: 400_000_000,
      weightPercentage: 100,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-12-15'),
      periodicity: Periodicity.TRIMESTRAL,
      responsibleId: contratista.id,
    },
  });

  const period1 = await prisma.executionPeriod.upsert({
    where: {
      contractId_startDate_endDate: {
        contractId: contract.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-31'),
      },
    },
    update: {},
    create: {
      contractId: contract.id,
      label: 'Agosto 2026',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      isClosed: true,
    },
  });

  const period2 = await prisma.executionPeriod.upsert({
    where: {
      contractId_startDate_endDate: {
        contractId: contract.id,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-30'),
      },
    },
    update: {},
    create: {
      contractId: contract.id,
      label: 'Septiembre 2026',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-30'),
      isClosed: false,
    },
  });

  const existingRecords = await prisma.executionRecord.count({ where: { activityId: activity1.id } });
  if (existingRecords === 0) {
    await prisma.executionRecord.create({
      data: {
        activityId: activity1.id,
        periodId: period1.id,
        executedQuantity: 1,
        executedValue: 33_333_333,
        physicalPercentage: 8.33,
        result: 'Visita realizada al frente de obra Vía Vereda El Progreso',
        executionDate: new Date('2026-08-20'),
        registeredById: contratista.id,
      },
    });
    await prisma.activity.update({ where: { id: activity1.id }, data: { status: 'EN_PROCESO' } });

    await prisma.executionRecord.create({
      data: {
        activityId: activity2.id,
        periodId: period1.id,
        executedQuantity: 1,
        executedValue: 16_666_666,
        physicalPercentage: 8.33,
        result: 'Informe de agosto entregado',
        executionDate: new Date('2026-08-28'),
        registeredById: contratista.id,
      },
    });
    await prisma.activity.update({ where: { id: activity2.id }, data: { status: 'EN_PROCESO' } });

    await prisma.evidence.create({
      data: {
        contractId: contract.id,
        activityId: activity1.id,
        type: 'FOTOGRAFIA',
        description: 'Registro fotográfico visita agosto',
        storageKey: 'contracts/demo/evidences/demo-foto-1.jpg',
        originalFileName: 'visita-agosto.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 245_000,
        capturedAt: new Date('2026-08-20T09:15:00Z'),
        latitude: 4.710989,
        longitude: -74.072092,
        uploadedById: contratista.id,
      },
    });
  }

  await prisma.payment.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      contractId: contract.id,
      periodLabel: 'Agosto 2026',
      invoiceNumber: 'FAC-0081',
      accountNumber: 'CC-0081',
      value: 50_000_000,
      status: 'PAGADO',
      submittedDate: new Date('2026-09-02'),
      paidDate: new Date('2026-09-10'),
    },
  });

  const indicator = await prisma.indicator.upsert({
    where: { code: 'IND-GESTION-01' },
    update: {},
    create: {
      code: 'IND-GESTION-01',
      name: 'Informes de seguimiento entregados',
      category: 'GESTION',
      unit: 'Informes',
      formulaHint: 'Conteo manual de informes mensuales entregados y aprobados internamente por el contratista.',
    },
  });

  await prisma.indicatorResult.create({
    data: {
      indicatorId: indicator.id,
      contractId: contract.id,
      periodLabel: 'Agosto 2026',
      value: 1,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed completado. Usuario demo: contratista.demo@contractus360.local / Demo1234!');
  // eslint-disable-next-line no-console
  console.log(`Contrato demo: ${contract.contractNumber} (id: ${contract.id})`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
