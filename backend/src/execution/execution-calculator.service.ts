import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type Semaphore = 'GREEN' | 'YELLOW' | 'RED';

export interface WeightedItem {
  weightPercentage: Prisma.Decimal | number;
  percentageExecuted: Prisma.Decimal | number;
}

/**
 * Motor de cálculo contractual. Toda operación monetaria/porcentual usa
 * Prisma.Decimal para evitar errores de redondeo de punto flotante en
 * valores financieros (ver docs/ARCHITECTURE.md).
 */
@Injectable()
export class ExecutionCalculatorService {
  /** Porcentaje simple: ejecutado / programado * 100, con protección contra división por cero. */
  percentage(executed: Prisma.Decimal | number, planned: Prisma.Decimal | number): Prisma.Decimal {
    const plannedDecimal = new Prisma.Decimal(planned);
    if (plannedDecimal.isZero()) {
      return new Prisma.Decimal(0);
    }
    return new Prisma.Decimal(executed).div(plannedDecimal).mul(100).toDecimalPlaces(2);
  }

  /**
   * Promedio ponderado de ejecución física, por ejemplo entre actividades de
   * una obligación, o entre obligaciones de un contrato. La suma de pesos no
   * necesariamente es 100 (se normaliza), para tolerar datos incompletos sin
   * romper el cálculo.
   */
  weightedAverage(items: WeightedItem[]): Prisma.Decimal {
    const totalWeight = items.reduce(
      (acc, item) => acc.add(new Prisma.Decimal(item.weightPercentage)),
      new Prisma.Decimal(0),
    );
    if (totalWeight.isZero()) {
      return new Prisma.Decimal(0);
    }
    const weightedSum = items.reduce(
      (acc, item) =>
        acc.add(
          new Prisma.Decimal(item.weightPercentage).mul(new Prisma.Decimal(item.percentageExecuted)),
        ),
      new Prisma.Decimal(0),
    );
    return weightedSum.div(totalWeight).toDecimalPlaces(2);
  }

  financialExecution(executedValue: Prisma.Decimal | number, currentValue: Prisma.Decimal | number): Prisma.Decimal {
    return this.percentage(executedValue, currentValue);
  }

  /**
   * Ejecución temporal, excluyendo días suspendidos del cómputo tanto del
   * numerador (días transcurridos) como del denominador (plazo total).
   */
  temporalExecution(
    startDate: Date,
    endDate: Date,
    referenceDate: Date,
    suspendedDays = 0,
  ): { elapsedDays: number; totalDays: number; percentage: Prisma.Decimal } {
    const totalDays = Math.max(daysBetween(startDate, endDate) - suspendedDays, 0);
    const rawElapsed = daysBetween(startDate, clampDate(referenceDate, startDate, endDate));
    const elapsedDays = Math.max(Math.min(rawElapsed - suspendedDays, totalDays), 0);

    return {
      elapsedDays,
      totalDays,
      percentage: this.percentage(elapsedDays, totalDays || 1),
    };
  }

  /** Desviación = ejecución física - ejecución temporal. Positivo = adelantado, negativo = atrasado. */
  deviation(physicalPercentage: Prisma.Decimal | number, temporalPercentage: Prisma.Decimal | number): Prisma.Decimal {
    return new Prisma.Decimal(physicalPercentage).sub(new Prisma.Decimal(temporalPercentage)).toDecimalPlaces(2);
  }

  /**
   * Semáforo de cumplimiento. Los umbrales son configurables por contrato
   * (Contract.toleranceYellow / toleranceRed), nunca fijos en código.
   */
  semaphore(
    deviationValue: Prisma.Decimal | number,
    toleranceYellow: Prisma.Decimal | number,
    toleranceRed: Prisma.Decimal | number,
  ): Semaphore {
    const dev = new Prisma.Decimal(deviationValue);
    const absDeviation = dev.isNegative() ? dev.neg() : dev;

    if (dev.isNegative() && absDeviation.gte(new Prisma.Decimal(toleranceRed))) {
      return 'RED';
    }
    if (dev.isNegative() && absDeviation.gte(new Prisma.Decimal(toleranceYellow))) {
      return 'YELLOW';
    }
    return 'GREEN';
  }
}

function daysBetween(start: Date, end: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.max(Math.round((end.getTime() - start.getTime()) / MS_PER_DAY), 0);
}

function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}
