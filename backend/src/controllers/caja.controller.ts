/**
 * ====================================================
 * CONTROLADOR DE CAJA Y ARQUEOS (CONTROLLER LAYER)
 * ====================================================
 * Procesa las peticiones HTTP para apertura de turno con base,
 * consulta de estado en tiempo real, arqueo y cierre de caja.
 */

import { Request, Response } from 'express';
import { cajaService } from '../services/caja.service';

export class CajaController {
  /**
   * GET /api/caja/status
   * Consulta el estado en tiempo real de la caja (abierta/cerrada, base, ventas y esperado).
   */
  async getStatus(_req: Request, res: Response) {
    try {
      const status = await cajaService.getCurrentStatus();
      return res.status(200).json(status);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al consultar estado de caja', details: error.message || error });
    }
  }

  /**
   * POST /api/caja/open
   * Abre la sesión de caja registrando la base inicial con su desglose de billetes y monedas.
   */
  async openSession(req: Request, res: Response) {
    try {
      const { denominations, notes } = req.body;

      if (!denominations || typeof denominations !== 'object') {
        return res.status(400).json({
          error: 'El desglose de monedas y billetes (denominations) es obligatorio'
        });
      }

      const session = await cajaService.openSession({ denominations, notes });
      return res.status(201).json(session);
    } catch (error: any) {
      if (error.message === 'SESSION_ALREADY_OPEN') {
        return res.status(400).json({
          error: 'Ya existe una caja abierta actualmente. Debe cerrar la caja activa antes de abrir una nueva.'
        });
      }
      return res.status(500).json({ error: 'Error al abrir la caja', details: error.message || error });
    }
  }

  /**
   * POST /api/caja/close
   * Cierra y arquea la caja activa calculando el dinero físico, esperado y diferencias.
   */
  async closeSession(req: Request, res: Response) {
    try {
      const { denominations, closingNotes } = req.body;

      if (!denominations || typeof denominations !== 'object') {
        return res.status(400).json({
          error: 'El conteo físico de billetes y monedas de cierre (denominations) es obligatorio'
        });
      }

      const closedSession = await cajaService.closeSession({ denominations, closingNotes });
      return res.status(200).json(closedSession);
    } catch (error: any) {
      if (error.message === 'NO_ACTIVE_SESSION') {
        return res.status(400).json({
          error: 'No hay ninguna caja abierta actualmente para cerrar.'
        });
      }
      return res.status(500).json({ error: 'Error al cerrar la caja', details: error.message || error });
    }
  }

  /**
   * GET /api/caja/history
   * Obtiene el listado histórico de sesiones de caja y arqueos.
   */
  async getHistory(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;

      const history = await cajaService.getSessionHistory(limit, page);
      return res.status(200).json(history);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener historial de cajas', details: error.message || error });
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
      return res.status(500).json({ error: 'Error al obtener sesión de caja', details: error.message || error });
    }
  }
}

export const cajaController = new CajaController();
