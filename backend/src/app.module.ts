import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { ContractsModule } from './contracts/contracts.module';
import { ContractModificationsModule } from './contract-modifications/contract-modifications.module';
import { ObligationsModule } from './obligations/obligations.module';
import { ActivitiesModule } from './activities/activities.module';
import { ExecutionModule } from './execution/execution.module';
import { EvidencesModule } from './evidences/evidences.module';
import { DocumentsModule } from './documents/documents.module';
import { AlertsModule } from './alerts/alerts.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { PaymentsModule } from './payments/payments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    StorageModule,
    AuthModule,
    ContractsModule,
    ContractModificationsModule,
    ObligationsModule,
    ActivitiesModule,
    ExecutionModule,
    EvidencesModule,
    DocumentsModule,
    AlertsModule,
    IndicatorsModule,
    PaymentsModule,
    DashboardModule,
    ReportsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
