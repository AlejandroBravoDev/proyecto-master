/**
 * ====================================================
 * CONTROLADOR DE CAJA Y ARQUEOS (CONTROLLER LAYER)
 * ====================================================
 * Procesa las peticiones HTTP para apertura de turno con base,
 * consulta de estado en tiempo real, arqueo, cierre de caja y edición administrativa.
 */

import { Request, Response } from 'express';
import { cajaService } from '../services/caja.service';
import { errorDetails, parseId, parseOptionalText, parsePagination, toFiniteNumber } from '../utils/http.utils';

/** `userId` es opcional: vacío = sin auditor; si viene debe ser un id válido (null = inválido). */
function parseOptionalUserId(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  return parseId(value);
}

export class CajaController {
  /**
   * GET /api/caja/status
   * Consulta el estado en tiempo real de la caja (abierta/cerrada, base y usuario auditor).
   */
  async getStatus(_req: Request, res: Response) {
    try {
      const status = await cajaService.getCurrentStatus();
      return res.status(200).json(status);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al consultar estado de caja', details: errorDetails(error) });
    }
  }

  /**
   * POST /api/caja/open
   * Abre la sesión de caja registrando la base inicial con su desglose de billetes y monedas y usuario.
   */
  async openSession(req: Request, res: Response) {
    try {
      const { denominations, notes, userId } = req.body ?? {};

      if (!denominations || typeof denominations !== 'object') {
        return res.status(400).json({
          error: 'El desglose de monedas y billetes (denominations) es obligatorio'
        });
      }

      const parsedUserId = parseOptionalUserId(userId);
      if (parsedUserId === null) {
        return res.status(400).json({ error: 'userId inválido' });
      }

      const session = await cajaService.openSession({ denominations, notes, userId: parsedUserId });
      return res.status(201).json(session);
    } catch (error: any) {
      if (error.message === 'SESSION_ALREADY_OPEN') {
        return res.status(400).json({
          error: 'Ya existe una caja abierta actualmente. Debe cerrar la caja activa antes de abrir una nueva.'
        });
      }
      if (error.message === 'USER_NOT_FOUND' || error.code === 'P2003') {
        return res.status(400).json({ error: 'El usuario indicado (userId) no existe' });
      }
      return res.status(500).json({ error: 'Error al abrir la caja', details: errorDetails(error) });
    }
  }

  /**
   * POST /api/caja/close
   * Cierra la caja activa registrando el conteo final y archivando comandas activas.
   */
  async closeSession(req: Request, res: Response) {
    try {
      const { denominations, closingNotes, userId } = req.body ?? {};

      if (!denominations || typeof denominations !== 'object') {
        return res.status(400).json({
          error: 'El conteo físico de billetes y monedas de cierre (denominations) es obligatorio'
        });
      }

      const parsedUserId = parseOptionalUserId(userId);
      if (parsedUserId === null) {
        return res.status(400).json({ error: 'userId inválido' });
      }

      const closedSession = await cajaService.closeSession({ denominations, closingNotes, userId: parsedUserId });
      return res.status(200).json(closedSession);
    } catch (error: any) {
      if (error.message === 'NO_ACTIVE_SESSION') {
        return res.status(400).json({
          error: 'No hay ninguna caja abierta actualmente para cerrar.'
        });
      }
      if (error.message === 'USER_NOT_FOUND' || error.code === 'P2003') {
        return res.status(400).json({ error: 'El usuario indicado (userId) no existe' });
      }
      return res.status(500).json({ error: 'Error al cerrar la caja', details: errorDetails(error) });
    }
  }

  /**
   * PUT /api/caja/:id
   * Permite la edición administrativa de montos y observaciones de una sesión de caja.
   */
  async updateSession(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { initialAmount, finalAmount, notes, closingNotes } = req.body ?? {};

      const data: { initialAmount?: number; finalAmount?: number; notes?: string; closingNotes?: string } = {};

      for (const [field, raw] of [['initialAmount', initialAmount], ['finalAmount', finalAmount]] as const) {
        if (raw === undefined) continue;
        const amount = toFiniteNumber(raw);
        if (amount === null || amount < 0) {
          return res.status(400).json({ error: `El campo "${field}" debe ser un número mayor o igual a 0` });
        }
        data[field] = amount;
      }

      for (const [field, raw] of [['notes', notes], ['closingNotes', closingNotes]] as const) {
        const parsed = parseOptionalText(raw);
        if (!parsed.valid) {
          return res.status(400).json({ error: `El campo "${field}" debe ser texto` });
        }
        // Un texto vacío limpia la nota (la columna acepta null)
        if (parsed.value !== undefined) data[field] = parsed.value ?? '';
      }

      const updated = await cajaService.updateSession(id, data);
      return res.status(200).json(updated);
    } catch (error: any) {
      if (error.message === 'SESSION_NOT_FOUND') {
        return res.status(404).json({ error: 'Sesión de caja no encontrada.' });
      }
      return res.status(500).json({ error: 'Error al actualizar sesión de caja', details: errorDetails(error) });
    }
  }

  /**
   * GET /api/caja/history
   * Obtiene el listado histórico de sesiones de caja con paginación y filtro opcional por usuario.
   */
  async getHistory(req: Request, res: Response) {
    try {
      const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 200 });
      if (pagination === null) {
        return res.status(400).json({ error: 'page y limit deben ser enteros mayores a 0' });
      }
      const { page, limit } = pagination ?? { page: 1, limit: 20 };

      let openedByUserId: number | undefined;
      if (req.query.openedByUserId !== undefined && req.query.openedByUserId !== '') {
        const parsed = parseId(req.query.openedByUserId);
        if (parsed === null) {
          return res.status(400).json({ error: 'openedByUserId inválido' });
        }
        openedByUserId = parsed;
      }

      const history = await cajaService.getSessionHistory(limit, page, openedByUserId);
      return res.status(200).json(history);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener historial de cajas', details: errorDetails(error) });
    }
  }

  /**
   * GET /api/caja/session/:id
   * Obtiene el detalle completo de una sesión específica por ID.
   */
  async getSessionById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const session = await cajaService.getSessionById(id);

      if (!session) {
        return res.status(404).json({ error: 'Sesión de caja no encontrada' });
      }

      return res.status(200).json(session);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener sesión de caja', details: errorDetails(error) });
    }
  }
}

export const cajaController = new CajaController();
