/**
 * ====================================================
 * SERVICIO DE CAJA (MODEL/SERVICE LAYER)
 * ====================================================
 * Administra exclusivamente el control de apertura y cierre de caja:
 * - Apertura de caja: ingreso de la base inicial con desglose de monedas y billetes
 * - Consulta de estado en tiempo real (si está abierta o cerrada)
 * - Cierre de caja: ingreso del conteo final de monedas y billetes al final del día/turno
 * - Historial y auditoría de sesiones de caja
 */

import prisma from '../prisma/client';

export interface DenominationItem {
  value: number;
  count: number;
}

export type DenominationsInput = Record<string, number> | DenominationItem[];

export class CajaService {
  /**
   * Helper para calcular el monto total a partir del desglose de monedas y billetes.
   * Evita imprecisiones de coma flotante redondeando a 2 decimales.
   */
  private calculateDenominationsTotal(denominations: DenominationsInput): {
    total: number;
    normalized: Record<string, number>;
  } {
    let total = 0;
    const normalized: Record<string, number> = {};

    if (Array.isArray(denominations)) {
      for (const item of denominations) {
        const val = Number(item.value);
        const count = Math.max(0, parseInt(String(item.count || 0), 10));
        if (val > 0 && count > 0) {
          total += val * count;
          normalized[val.toString()] = count;
        }
      }
    } else if (typeof denominations === 'object' && denominations !== null) {
      for (const [key, rawCount] of Object.entries(denominations)) {
        const val = parseFloat(key);
        const count = Math.max(0, parseInt(String(rawCount || 0), 10));
        if (!isNaN(val) && val > 0 && count > 0) {
          total += val * count;
          normalized[val.toString()] = count;
        }
      }
    }

    return {
      total: Number(total.toFixed(2)),
      normalized
    };
  }

  /**
   * Obtiene la sesión de caja actualmente abierta (si existe).
   */
  async getActiveSessionEntity() {
    return prisma.cashSession.findFirst({
      where: { status: 'OPEN' }
    });
  }

  /**
   * Consulta el estado en tiempo real de la caja (abierta o cerrada).
   * Si está abierta, retorna la base inicial y el desglose con el que se abrió.
   */
  async getCurrentStatus() {
    const activeSession = await this.getActiveSessionEntity();

    if (!activeSession) {
      // Obtener la última sesión cerrada como referencia
      const lastClosed = await prisma.cashSession.findFirst({
        where: { status: 'CLOSED' },
        orderBy: { closedAt: 'desc' }
      });

      return {
        isOpen: false,
        activeSession: null,
        lastClosedSession: lastClosed
          ? {
              ...lastClosed,
              initialDenominations: JSON.parse(lastClosed.initialDenominations || '{}'),
              finalDenominations: lastClosed.finalDenominations
                ? JSON.parse(lastClosed.finalDenominations)
                : null
            }
          : null
      };
    }

    let parsedInitialDenominations = {};
    try {
      parsedInitialDenominations = JSON.parse(activeSession.initialDenominations);
    } catch {
      parsedInitialDenominations = {};
    }

    return {
      isOpen: true,
      activeSession: {
        id: activeSession.id,
        sessionNumber: activeSession.sessionNumber,
        status: activeSession.status,
        openedAt: activeSession.openedAt,
        initialAmount: activeSession.initialAmount,
        initialDenominations: parsedInitialDenominations,
        notes: activeSession.notes
      }
    };
  }

  /**
   * Abre la caja para el día o turno registrando la base inicial con su desglose de billetes y monedas.
   */
  async openSession(data: { denominations: DenominationsInput; notes?: string }) {
    // 1. Validar que no haya una caja abierta actualmente
    const existingOpen = await this.getActiveSessionEntity();
    if (existingOpen) {
      throw new Error('SESSION_ALREADY_OPEN');
    }

    // 2. Calcular la base inicial y normalizar desglose
    const { total, normalized } = this.calculateDenominationsTotal(data.denominations);

    // 3. Generar número secuencial correlativo (ej: CAJA-2026-0001)
    const count = await prisma.cashSession.count();
    const sessionNumber = `CAJA-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    // 4. Crear registro de apertura
    const newSession = await prisma.cashSession.create({
      data: {
        sessionNumber,
        status: 'OPEN',
        openedAt: new Date(),
        initialAmount: total,
        initialDenominations: JSON.stringify(normalized),
        notes: data.notes || null
      }
    });

    return {
      ...newSession,
      initialDenominations: normalized
    };
  }

  /**
   * Cierra la caja activa registrando el conteo final de billetes y monedas del día.
   */
  async closeSession(data: { denominations: DenominationsInput; closingNotes?: string }) {
    // 1. Obtener la sesión activa
    const activeSession = await this.getActiveSessionEntity();
    if (!activeSession) {
      throw new Error('NO_ACTIVE_SESSION');
    }

    // 2. Calcular el total contado al cierre a partir del desglose
    const { total: finalAmount, normalized: finalNormalized } = this.calculateDenominationsTotal(data.denominations);

    // 3. Actualizar y cerrar la sesión en base de datos
    const closedSession = await prisma.cashSession.update({
      where: { id: activeSession.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        finalAmount,
        finalDenominations: JSON.stringify(finalNormalized),
        closingNotes: data.closingNotes || null
      }
    });

    return {
      ...closedSession,
      initialDenominations: JSON.parse(closedSession.initialDenominations || '{}'),
      finalDenominations: finalNormalized
    };
  }

  /**
   * Consulta el historial de todas las sesiones de caja con paginación opcional.
   */
  async getSessionHistory(limit = 20, page = 1) {
    const skip = (Math.max(1, page) - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.cashSession.findMany({
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' }
      }),
      prisma.cashSession.count()
    ]);

    const formattedSessions = sessions.map((s) => {
      let initialDenom = {};
      let finalDenom = null;
      try {
        initialDenom = JSON.parse(s.initialDenominations || '{}');
      } catch {
        initialDenom = {};
      }
      if (s.finalDenominations) {
        try {
          finalDenom = JSON.parse(s.finalDenominations);
        } catch {
          finalDenom = {};
        }
      }

      return {
        ...s,
        initialDenominations: initialDenom,
        finalDenominations: finalDenom
      };
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      sessions: formattedSessions
    };
  }

  /**
   * Consulta el detalle completo de una sesión de caja por ID.
   */
  async getSessionById(id: number) {
    const session = await prisma.cashSession.findUnique({
      where: { id }
    });

    if (!session) return null;

    let initialDenominations = {};
    let finalDenominations = null;
    try {
      initialDenominations = JSON.parse(session.initialDenominations || '{}');
    } catch {
      initialDenominations = {};
    }
    if (session.finalDenominations) {
      try {
        finalDenominations = JSON.parse(session.finalDenominations);
      } catch {
        finalDenominations = {};
      }
    }

    return {
      ...session,
      initialDenominations,
      finalDenominations
    };
  }
}

export const cajaService = new CajaService();
