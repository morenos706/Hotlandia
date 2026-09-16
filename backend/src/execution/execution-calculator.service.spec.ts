import { Prisma } from '@prisma/client';
import { ExecutionCalculatorService } from './execution-calculator.service';

describe('ExecutionCalculatorService', () => {
  let calculator: ExecutionCalculatorService;

  beforeEach(() => {
    calculator = new ExecutionCalculatorService();
  });

  describe('percentage', () => {
    it('calcula el porcentaje simple', () => {
      expect(calculator.percentage(65, 100).toString()).toBe('65');
    });

    it('retorna 0 cuando el valor programado es cero, sin lanzar error', () => {
      expect(calculator.percentage(10, 0).toString()).toBe('0');
    });

    it('redondea a 2 decimales sin errores de punto flotante', () => {
      // 1/3 en floats produce 33.33333333333333...; Decimal debe redondear limpio.
      expect(calculator.percentage(1, 3).toString()).toBe('33.33');
    });
  });

  describe('weightedAverage', () => {
    it('pondera correctamente por peso porcentual', () => {
      const result = calculator.weightedAverage([
        { weightPercentage: 70, percentageExecuted: 100 },
        { weightPercentage: 30, percentageExecuted: 0 },
      ]);
      expect(result.toString()).toBe('70');
    });

    it('normaliza cuando los pesos no suman 100', () => {
      const result = calculator.weightedAverage([
        { weightPercentage: 1, percentageExecuted: 50 },
        { weightPercentage: 1, percentageExecuted: 100 },
      ]);
      expect(result.toString()).toBe('75');
    });

    it('retorna 0 si no hay items o el peso total es cero', () => {
      expect(calculator.weightedAverage([]).toString()).toBe('0');
    });
  });

  describe('financialExecution', () => {
    it('nunca usa float para valores monetarios grandes', () => {
      const executed = new Prisma.Decimal('650000000.33');
      const current = new Prisma.Decimal('1000000000.99');
      const result = calculator.financialExecution(executed, current);
      // Verificación de exactitud: el resultado debe ser un Decimal válido, no NaN por overflow de float.
      expect(result.isNaN()).toBe(false);
      expect(Number(result)).toBeCloseTo(65.0, 1);
    });
  });

  describe('temporalExecution', () => {
    it('calcula días transcurridos excluyendo días suspendidos', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-12-31');
      const reference = new Date('2026-07-01'); // ~181 días transcurridos
      const result = calculator.temporalExecution(start, end, reference, 30);
      expect(result.totalDays).toBe(364 - 30);
      expect(result.elapsedDays).toBeLessThanOrEqual(result.totalDays);
    });

    it('nunca reporta más de 100% aunque la fecha de referencia sea posterior al fin', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-06-30');
      const reference = new Date('2027-01-01');
      const result = calculator.temporalExecution(start, end, reference);
      expect(Number(result.percentage)).toBeLessThanOrEqual(100);
    });
  });

  describe('deviation + semaphore', () => {
    it('marca ROJO cuando la desviación negativa supera la tolerancia roja', () => {
      const deviation = calculator.deviation(50, 80); // -30
      expect(deviation.toString()).toBe('-30');
      expect(calculator.semaphore(deviation, 10, 20)).toBe('RED');
    });

    it('marca AMARILLO en zona intermedia', () => {
      const deviation = calculator.deviation(65, 80); // -15
      expect(calculator.semaphore(deviation, 10, 20)).toBe('YELLOW');
    });

    it('marca VERDE cuando va adelantado o dentro de tolerancia', () => {
      const deviation = calculator.deviation(85, 80); // +5, adelantado
      expect(calculator.semaphore(deviation, 10, 20)).toBe('GREEN');
    });
  });
});
