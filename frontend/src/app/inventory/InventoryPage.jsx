import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import InventoryHeaderCard from './components/InventoryHeaderCard';
import IngredientTable from './components/IngredientTable';
import IngredientModal from './components/IngredientModal';
import StockAdjustmentModal from './components/StockAdjustmentModal';
import KardexModal from './components/KardexModal';
import BulkImportModal from './components/BulkImportModal';
import {
  fetchIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  fetchInventoryAlerts,
  downloadIngredientsTemplate,
  exportIngredientsReport,
} from './services/inventoryService';

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Export/Download loading indicators
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Modals state
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);

  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentIngredient, setAdjustmentIngredient] = useState(null);

  const [kardexModalOpen, setKardexModalOpen] = useState(false);
  const [kardexIngredient, setKardexIngredient] = useState(null);

  const [importModalOpen, setImportModalOpen] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load ingredients & alerts
  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([fetchIngredients(), fetchInventoryAlerts().catch(() => [])])
      .then(([ingData, alertData]) => {
        setIngredients(Array.isArray(ingData) ? ingData : []);
        setAlerts(Array.isArray(alertData) ? alertData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando inventario:', err);
        setError(err.message || 'No se pudo conectar con el servidor para cargar el inventario.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers for modal actions
  const handleOpenCreateModal = () => {
    setSelectedIngredient(null);
    setIngredientModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setSelectedIngredient(item);
    setIngredientModalOpen(true);
  };

  const handleSaveIngredient = async (formData) => {
    if (selectedIngredient) {
      await updateIngredient(selectedIngredient.id, formData);
      showToast('Insumo actualizado correctamente.');
    } else {
      await createIngredient(formData);
      showToast('Insumo creado correctamente.');
    }
    loadData();
  };

  const handleOpenAdjustStock = (item) => {
    setAdjustmentIngredient(item);
    setAdjustmentModalOpen(true);
  };

  const handleSaveAdjustment = async (id, adjustmentData) => {
    await updateIngredient(id, adjustmentData);
    showToast('Ajuste de stock registrado en Kardex.');
    loadData();
  };

  const handleOpenKardex = (item = null) => {
    setKardexIngredient(item);
    setKardexModalOpen(true);
  };

  const handleDeleteIngredient = async (item) => {
    if (window.confirm(`¿Estás seguro de eliminar el insumo "${item.name}"? Esta acción no se puede deshacer.`)) {
      try {
        await deleteIngredient(item.id);
        showToast('Insumo eliminado del inventario.');
        loadData();
      } catch (err) {
        alert(err.message || 'No se pudo eliminar el insumo.');
      }
    }
  };

  // Download template handler
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await downloadIngredientsTemplate();
      showToast('Plantilla descargada correctamente.');
    } catch (err) {
      showToast(err.message || 'Error al descargar la plantilla', 'error');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Export excel report handler
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await exportIngredientsReport();
      showToast('Reporte de inventario exportado a Excel.');
    } catch (err) {
      showToast(err.message || 'Error al exportar reporte', 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      // Search term
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Status filter
      if (activeFilter === 'low_stock') {
        return item.currentStock <= item.minimumStock;
      }

      return true;
    });
  }, [ingredients, searchTerm, activeFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl border flex items-center space-x-3 text-sm font-bold animate-slide-up ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-[#E63946] text-white border-red-700'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Card */}
      <InventoryHeaderCard
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onNewIngredientClick={handleOpenCreateModal}
        onViewKardexClick={() => handleOpenKardex(null)}
        onDownloadTemplateClick={handleDownloadTemplate}
        onExportExcelClick={handleExportExcel}
        onImportExcelClick={() => setImportModalOpen(true)}
        downloadingTemplate={downloadingTemplate}
        exportingExcel={exportingExcel}
        alertsCount={alerts.length}
      />

      {/* Main Table / State */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-800 shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-[#E63946] shrink-0" />
            <div>
              <p className="font-bold text-[#584235]">Error al conectar con la API de Inventario</p>
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
        <IngredientTable
          ingredients={filteredIngredients}
          onAdjustStock={handleOpenAdjustStock}
          onViewKardex={handleOpenKardex}
          onEdit={handleOpenEditModal}
          onDelete={handleDeleteIngredient}
        />
      )}

      {/* Modal: Create/Edit Ingredient */}
      <IngredientModal
        isOpen={ingredientModalOpen}
        onClose={() => setIngredientModalOpen(false)}
        onSubmit={handleSaveIngredient}
        initialData={selectedIngredient}
      />

      {/* Modal: Adjust Stock (Kardex) */}
      <StockAdjustmentModal
        isOpen={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        onSubmit={handleSaveAdjustment}
        ingredient={adjustmentIngredient}
      />

      {/* Modal: View Kardex History */}
      <KardexModal
        isOpen={kardexModalOpen}
        onClose={() => setKardexModalOpen(false)}
        ingredient={kardexIngredient}
      />

      {/* Modal: Bulk Excel Import with Drag & Drop */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={() => {
          showToast('Carga masiva procesada exitosamente.');
          loadData();
        }}
      />
    </div>
  );
}
