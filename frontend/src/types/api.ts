export interface Contract {
  id: string;
  contractNumber: string;
  vigencia: number;
  contractType: string;
  modality: string;
  purpose: string;
  status: string;
  initialValue: string;
  currentValue: string;
  startDate: string;
  endDate: string;
  termDays: number;
  observations?: string | null;
}

export interface Obligation {
  id: string;
  code: string;
  description: string;
  weightPercentage: string;
  goal?: string | null;
  unitOfMeasure?: string | null;
  activities: Activity[];
}

export interface Activity {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  unitOfMeasure: string;
  plannedQuantity: string;
  assignedValue: string;
  weightPercentage: string;
  status: 'PENDIENTE' | 'EN_PROCESO' | 'EJECUTADA' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION';
  startDate: string;
  endDate: string;
  requiresEvidence: boolean;
}

export interface ExecutionPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

export type Semaphore = 'GREEN' | 'YELLOW' | 'RED';

export interface ContractDashboard {
  contract: Contract;
  execution: {
    physicalPercentage: string;
    financialPercentage: string;
    temporalPercentage: string;
    elapsedDays: number;
    totalDays: number;
    deviation: string;
    semaphore: Semaphore;
    executedValue: string;
    balance: string;
  };
  obligations: { total: number };
  activities: { total: number; pendientes: number; enProceso: number; ejecutadas: number };
  evidenceCount: number;
  unresolvedAlerts: number;
  paymentsPending: number;
  sCurve: Array<{
    periodLabel: string;
    date: string;
    plannedPercentage: string;
    executedPercentage: string;
    executedValue: string;
  }>;
}

export interface GlobalDashboard {
  totalContracts: number;
  totalValue: string;
  totalExecutedValue: string;
  averagePhysicalExecution: string;
  contractsNearExpiry: number;
  pendingActivities: number;
  evidenceCount: number;
  unresolvedAlerts: number;
  contractsByStatus: Record<string, number>;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  isResolved: boolean;
  createdAt: string;
}

export type PaymentStatus = 'PENDIENTE' | 'RADICADO' | 'EN_REVISION' | 'APROBADO' | 'PAGADO' | 'RECHAZADO';

export interface Payment {
  id: string;
  periodLabel: string;
  invoiceNumber?: string | null;
  accountNumber?: string | null;
  disbursementNumber?: string | null;
  value: string;
  status: PaymentStatus;
  submittedDate?: string | null;
  paidDate?: string | null;
  observations?: string | null;
  createdAt: string;
}
