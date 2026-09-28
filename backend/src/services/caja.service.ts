/**
 * ====================================================
 * SERVICIO DE CAJA (MODEL/SERVICE LAYER)
 * ====================================================
 * Administra exclusivamente el control de apertura y cierre de caja:
 * - Apertura de caja: ingreso de la base inicial con desglose de monedas y billetes y auditoría de usuario
 * - Consulta de estado en tiempo real (si está abierta o cerrada) con usuario responsable
 * - Cierre de caja: ingreso del conteo final, desactivación/archivado de comandas activas y auditoría
 * - Historial y auditoría de sesiones de caja con filtrado por usuario
 * - Edición administrativa de sesiones de caja
 */

import prisma from '../prisma/client';

export interface DenominationItem {
  value: number;
  count: number;
}

export type DenominationsInput = Record<string, number> | DenominationItem[];

const USER_SELECT_FIELDS = {
  select: {
    id: true,
    fullName: true,
    username: true
  }
};

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
      where: { status: 'OPEN' },
      include: {
        openedByUser: USER_SELECT_FIELDS,
        closedByUser: USER_SELECT_FIELDS
      }
    });
  }

  /**
   * Consulta el estado en tiempo real de la caja (abierta o cerrada).
   * Si está abierta, retorna la base inicial, el desglose y el usuario responsable.
   */
  async getCurrentStatus() {
    const activeSession = await this.getActiveSessionEntity();

    if (!activeSession) {
      // Obtener la última sesión cerrada como referencia
      const lastClosed = await prisma.cashSession.findFirst({
        where: { status: 'CLOSED' },
        orderBy: { closedAt: 'desc' },
        include: {
          openedByUser: USER_SELECT_FIELDS,
          closedByUser: USER_SELECT_FIELDS
        }
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
        notes: activeSession.notes,
        openedByUserId: activeSession.openedByUserId,
        openedByUser: activeSession.openedByUser
      }
    };
  }

  /**
   * Abre la caja para el día o turno registrando la base inicial con su desglose de billetes y monedas y usuario.
   */
  async openSession(data: { denominations: DenominationsInput; notes?: string; userId?: number }) {
    // 1. Validar que no haya una caja abierta actualmente
    const existingOpen = await this.getActiveSessionEntity();
    if (existingOpen) {
      throw new Error('SESSION_ALREADY_OPEN');
    }

    // 2. Calcular la base inicial y normalizar desglose
    const { total, normalized } = this.calculateDenominationsTotal(data.denominations);

    // 3. Generar número secuencial correlativo seguro y libre de colisiones (ej: CAJA-YYYY-XXXX)
    const currentYear = new Date().getFullYear();
    const lastSession = await prisma.cashSession.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true, sessionNumber: true }
    });

    let nextSessionSeq = (lastSession?.id ?? 0) + 1;
    if (lastSession?.sessionNumber) {
      const match = lastSession.sessionNumber.match(/(\d+)$/);
      if (match) {
        const lastNum = parseInt(match[1], 10);
        if (!isNaN(lastNum)) {
          nextSessionSeq = Math.max(nextSessionSeq, lastNum + 1);
        }
      }
    }

    let sessionNumber = `CAJA-${currentYear}-${nextSessionSeq.toString().padStart(4, '0')}`;
    while (await prisma.cashSession.findUnique({ where: { sessionNumber } })) {
      nextSessionSeq++;
      sessionNumber = `CAJA-${currentYear}-${nextSessionSeq.toString().padStart(4, '0')}`;
    }

    // 4. Crear registro de apertura con usuario auditor
    const newSession = await prisma.cashSession.create({
      data: {
        sessionNumber,
        status: 'OPEN',
        openedAt: new Date(),
        initialAmount: total,
        initialDenominations: JSON.stringify(normalized),
        notes: data.notes || null,
        openedByUserId: data.userId ? Number(data.userId) : null
      },
      include: {
        openedByUser: USER_SELECT_FIELDS,
        closedByUser: USER_SELECT_FIELDS
      }
    });

    return {
      ...newSession,
      initialDenominations: normalized
    };
  }

  /**
   * Cierra la caja activa registrando el conteo final de billetes y monedas,
   * y desactiva (archiva) automáticamente todas las comandas del turno que estén activas.
   */
  async closeSession(data: { denominations: DenominationsInput; closingNotes?: string; userId?: number }) {
    // 1. Obtener la sesión activa
    const activeSession = await this.getActiveSessionEntity();
    if (!activeSession) {
      throw new Error('NO_ACTIVE_SESSION');
    }

    // 2. Calcular el total contado al cierre a partir del desglose
    const { total: finalAmount, normalized: finalNormalized } = this.calculateDenominationsTotal(data.denominations);

    // 3. Transacción atómica: Actualizar sesión a CLOSED y archivar comandas activas
    const closedSession = await prisma.$transaction(async (tx) => {
      // A. Desactivar comandas activas del turno
      await tx.order.updateMany({
        where: { active: true },
        data: { active: false }
      });

      // B. Actualizar y cerrar la sesión de caja
      return tx.cashSession.update({
        where: { id: activeSession.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          finalAmount,
          finalDenominations: JSON.stringify(finalNormalized),
          closingNotes: data.closingNotes || null,
          closedByUserId: data.userId ? Number(data.userId) : null
        },
        include: {
          openedByUser: USER_SELECT_FIELDS,
          closedByUser: USER_SELECT_FIELDS
        }
      });
    });

    return {
      ...closedSession,
      initialDenominations: JSON.parse(closedSession.initialDenominations || '{}'),
      finalDenominations: finalNormalized
    };
  }

  /**
   * Permite la edición administrativa de una sesión de caja existente.
   */
  async updateSession(
    id: number,
    data: {
      initialAmount?: number;
      finalAmount?: number;
      notes?: string;
      closingNotes?: string;
    }
  ) {
    const session = await prisma.cashSession.findUnique({ where: { id } });
    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const updated = await prisma.cashSession.update({
      where: { id },
      data: {
        initialAmount: data.initialAmount !== undefined ? Number(data.initialAmount) : undefined,
        finalAmount: data.finalAmount !== undefined ? Number(data.finalAmount) : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
        closingNotes: data.closingNotes !== undefined ? data.closingNotes : undefined
      },
      include: {
        openedByUser: USER_SELECT_FIELDS,
        closedByUser: USER_SELECT_FIELDS
      }
    });

    let initialDenom = {};
    let finalDenom = null;
    try {
      initialDenom = JSON.parse(updated.initialDenominations || '{}');
    } catch {
      initialDenom = {};
    }
    if (updated.finalDenominations) {
      try {
        finalDenom = JSON.parse(updated.finalDenominations);
      } catch {
        finalDenom = {};
      }
    }

    return {
      ...updated,
      initialDenominations: initialDenom,
      finalDenominations: finalDenom
    };
  }

  /**
   * Consulta el historial de todas las sesiones de caja con paginación opcional y filtro por usuario.
   */
  async getSessionHistory(limit = 20, page = 1, openedByUserId?: number) {
    const skip = (Math.max(1, page) - 1) * limit;
    const whereClause = openedByUserId ? { openedByUserId: Number(openedByUserId) } : {};

    const [sessions, total] = await Promise.all([
      prisma.cashSession.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: {
          openedByUser: USER_SELECT_FIELDS,
          closedByUser: USER_SELECT_FIELDS
        }
      }),
      prisma.cashSession.count({ where: whereClause })
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
      where: { id },
      include: {
        openedByUser: USER_SELECT_FIELDS,
        closedByUser: USER_SELECT_FIELDS
      }
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
