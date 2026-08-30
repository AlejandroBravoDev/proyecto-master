import React, { useState, useEffect } from 'react';
import { X, Coins, Banknote, Clock, CheckCircle2, AlertCircle, Scale } from 'lucide-react';
import { fetchCajaSessionDetail } from '../services/cajaService';
import { formatCurrency, formatDateTime } from '../utils/cajaUtils';

export default function SessionDetailModal({
  isOpen,
  onClose,
  sessionId = null,
}) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && sessionId) {
      setError('');
      setLoading(true);
      fetchCajaSessionDetail(sessionId)
        .then((data) => {
          setSession(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'No se pudo cargar el detalle de la sesión.');
          setLoading(false);
        });
    }
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const isClosed = session?.status === 'CLOSED';
  const initialDenominations = session?.initialDenominations || {};
  const finalDenominations = session?.finalDenominations || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">
                Detalle de Sesión: {session?.sessionNumber || `ID #${sessionId}`}
              </h2>
              <p className="text-xs text-slate-400">
                Desglose físico de monedas y billetes (Apertura y Cierre)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-20 bg-slate-100 rounded-2xl" />
              <div className="h-40 bg-slate-100 rounded-2xl" />
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946]">
              {error}
            </div>
          ) : session ? (
            <>
              {/* Financial Balance Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between sm:justify-start sm:space-x-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Base Inicial (Apertura)
                  </span>
                  <span className="text-lg font-black text-slate-800">
                    {formatCurrency(session.initialAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-start sm:space-x-4 sm:border-l sm:border-slate-200 sm:pl-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Conteo Final (Cierre)
                  </span>
                  <span className="text-lg font-black text-emerald-700">
                    {isClosed ? formatCurrency(session.finalAmount || 0) : 'Turno Abierto'}
                  </span>
                </div>
              </div>

              {/* Timestamps & Notes */}
              <div className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-slate-200/80 space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-500 gap-1">
                  <span>
                    <strong>Apertura:</strong> {formatDateTime(session.openedAt)}
                  </span>
                  {session.closedAt && (
                    <span>
                      <strong>Cierre:</strong> {formatDateTime(session.closedAt)}
                    </span>
                  )}
                </div>
                {session.notes && (
                  <p className="text-slate-600">
                    <strong>Nota de Apertura:</strong> {session.notes}
                  </p>
                )}
                {session.closingNotes && (
                  <p className="text-slate-600">
                    <strong>Nota de Cierre:</strong> {session.closingNotes}
                  </p>
                )}
              </div>

              {/* Breakdown Side-by-side: Opening float vs Closing physical count */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Initial Denominations */}
                <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-white">
                  <div className="flex items-center space-x-2 font-bold text-[#584235] border-b border-slate-100 pb-2">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span>Desglose de Apertura (Base)</span>
                  </div>

                  <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                    {Object.entries(initialDenominations).length === 0 ? (
                      <p className="text-slate-400 italic">Sin desglose específico.</p>
                    ) : (
                      Object.entries(initialDenominations).map(([denom, count]) => {
                        const val = parseFloat(denom);
                        return (
                          <div key={denom} className="flex justify-between py-1 border-b border-slate-50">
                            <span className="font-semibold text-slate-600">
                              {count}x {denom.includes('.') ? `$${denom}` : `$${denom}.00`}
                            </span>
                            <span className="font-black text-[#584235]">
                              {formatCurrency(val * Number(count))}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Final Denominations */}
                <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-white">
                  <div className="flex items-center space-x-2 font-bold text-[#584235] border-b border-slate-100 pb-2">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Desglose de Cierre (Final)</span>
                  </div>

                  <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                    {!isClosed ? (
                      <p className="text-slate-400 italic">El turno aún se encuentra abierto.</p>
                    ) : Object.entries(finalDenominations).length === 0 ? (
                      <p className="text-slate-400 italic">Sin desglose específico.</p>
                    ) : (
                      Object.entries(finalDenominations).map(([denom, count]) => {
                        const val = parseFloat(denom);
                        return (
                          <div key={denom} className="flex justify-between py-1 border-b border-slate-50">
                            <span className="font-semibold text-slate-600">
                              {count}x {denom.includes('.') ? `$${denom}` : `$${denom}.00`}
                            </span>
                            <span className="font-black text-[#584235]">
                              {formatCurrency(val * Number(count))}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
