import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import CajaStatusBanner from './components/CajaStatusBanner';
import SessionHistoryTable from './components/SessionHistoryTable';
import OpenCajaModal from './components/OpenCajaModal';
import CloseCajaModal from './components/CloseCajaModal';
import SessionDetailModal from './components/SessionDetailModal';
import EditCajaSessionModal from './components/EditCajaSessionModal';
import {
  fetchCajaStatus,
  fetchCajaHistory,
  openCajaSession,
  closeCajaSession,
  updateCajaSession,
  fetchUsersForCaja,
} from './services/cajaService';
import { showSuccessToast, showErrorAlert } from '../common/alertUtils';
import { useAuth } from '../auth/AuthContext';

export default function CajaPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [cajaStatus, setCajaStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Employee filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // Modals state
  const [openCajaModalOpen, setOpenCajaModalOpen] = useState(false);
  const [closeCajaModalOpen, setCloseCajaModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Load status and history
  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([fetchCajaStatus(), fetchCajaHistory(100, 1)])
      .then(([statusData, historyData]) => {
        setCajaStatus(statusData);
        setSessions(historyData.sessions || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando módulo de caja:', err);
        setError(err.message || 'No se pudo conectar con el servidor para cargar el estado de caja y los arqueos.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load employees list if user is ADMIN
  useEffect(() => {
    if (isAdmin) {
      fetchUsersForCaja()
        .then((usersList) => {
          setEmployees(usersList);
        })
        .catch((err) => {
          console.error('Error cargando lista de empleados en Caja:', err);
        });
    }
  }, [isAdmin]);

  // Filtered sessions by searchTerm and selectedEmployeeId
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedEmployeeId) {
        const openedId = s.openedByUserId ?? s.openedByUser?.id;
        if (String(openedId) !== String(selectedEmployeeId)) {
          return false;
        }
      }

      const term = searchTerm.toLowerCase();
      const openedByName = (s.openedByUser?.fullName || s.openedByUser?.username || '').toLowerCase();
      const matchesSearch =
        s.sessionNumber.toLowerCase().includes(term) ||
        openedByName.includes(term) ||
        (s.notes && s.notes.toLowerCase().includes(term)) ||
        (s.closingNotes && s.closingNotes.toLowerCase().includes(term));

      return matchesSearch;
    });
  }, [sessions, searchTerm, selectedEmployeeId]);

  // Handlers
  const handleOpenCaja = async (payload) => {
    try {
      const session = await openCajaSession({
        ...payload,
        userId: payload.userId ?? user?.id,
      });
      showSuccessToast(`Caja abierta exitosamente (${session.sessionNumber || ''}).`);
      loadData();
    } catch (err) {
      showErrorAlert('Error al abrir caja', err.message || 'No se pudo abrir la caja registradora.');
      throw err;
    }
  };

  const handleCloseCaja = async (payload) => {
    try {
      const closed = await closeCajaSession({
        ...payload,
        userId: payload.userId ?? user?.id,
      });
      showSuccessToast(`Turno cerrado y arqueado correctamente (${closed.sessionNumber || ''}).`);
      loadData();
    } catch (err) {
      showErrorAlert('Error al cerrar caja', err.message || 'No se pudo cerrar la caja registradora.');
      throw err;
    }
  };

  const handleViewSessionDetail = (id) => {
    setSelectedSessionId(id);
    setDetailModalOpen(true);
  };

  const handleOpenEditSession = (session) => {
    setEditingSession(session);
    setEditModalOpen(true);
  };

  const handleUpdateSession = async (id, payload) => {
    const updated = await updateCajaSession(id, payload);
    showSuccessToast(`Sesión ${updated.sessionNumber || ''} actualizada correctamente.`);
    loadData();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* 1. TOP SHIFT STATUS BANNER (Live metrics / Open / Close state) */}
      <CajaStatusBanner
        cajaStatus={cajaStatus}
        onOpenCajaClick={() => setOpenCajaModalOpen(true)}
        onCloseCajaClick={() => setCloseCajaModalOpen(true)}
        onViewHistoryClick={() => {
          const el = document.getElementById('history-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* 2. SESSIONS HISTORY AUDIT TABLE */}
      <div id="history-section">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-800 shadow-sm">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 text-[#E63946] shrink-0" />
              <div>
                <p className="font-bold text-[#584235]">Error al conectar con la API de Caja</p>
                <p className="text-xs text-rose-600 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reintentar</span>
            </button>
          </div>
        ) : (
          <SessionHistoryTable
            sessions={filteredSessions}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onViewSessionDetail={handleViewSessionDetail}
            onEditSession={handleOpenEditSession}
            isAdmin={isAdmin}
            employees={employees}
            selectedEmployeeId={selectedEmployeeId}
            onEmployeeChange={setSelectedEmployeeId}
          />
        )}
      </div>

      {/* Modal: Open Shift / Float Count */}
      <OpenCajaModal
        isOpen={openCajaModalOpen}
        onClose={() => setOpenCajaModalOpen(false)}
        onSubmit={handleOpenCaja}
      />

      {/* Modal: Close Shift / Arqueo */}
      <CloseCajaModal
        isOpen={closeCajaModalOpen}
        onClose={() => setCloseCajaModalOpen(false)}
        activeSession={cajaStatus?.activeSession}
        onSubmit={handleCloseCaja}
      />

      {/* Modal: Session Full Audit Detail */}
      <SessionDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        sessionId={selectedSessionId}
      />

      {/* Modal: Admin Edit Cash Session */}
      <EditCajaSessionModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingSession(null);
        }}
        session={editingSession}
        onSubmit={handleUpdateSession}
      />
    </div>
  );
}
