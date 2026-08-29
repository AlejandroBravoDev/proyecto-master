import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Edit2,
  MinusCircle,
  FileText
} from 'lucide-react';
import { importIngredientsExcel } from '../services/inventoryService';

export default function BulkImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setError('');
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = selectedFile.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setError('Por favor selecciona un archivo válido de Excel (.xlsx, .xls) o CSV.');
      return;
    }

    setFile(selectedFile);
    setResult(null);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Debes seleccionar o arrastrar un archivo de Excel.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const res = await importIngredientsExcel(file);
      setResult(res);
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error al procesar el archivo Excel.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">Carga Masiva de Insumos</h2>
              <p className="text-xs text-slate-400">Importa o actualiza materias primas desde Excel</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* If Result exists -> Display Summary */}
          {result ? (
            <div className="space-y-5 animate-fade-in">
              <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-center space-y-1">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-emerald-900">
                  {result.message || 'Carga Masiva Finalizada'}
                </h3>
                <p className="text-xs text-emerald-700">El archivo fue procesado con éxito.</p>
              </div>

              {/* Summary Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-center">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase block mb-1">
                    Creados
                  </span>
                  <span className="text-2xl font-black text-emerald-700">
                    {result.summary?.created ?? 0}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200/80 text-center">
                  <span className="text-[11px] font-bold text-blue-600 uppercase block mb-1">
                    Actualizados
                  </span>
                  <span className="text-2xl font-black text-blue-700">
                    {result.summary?.updated ?? 0}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-center">
                  <span className="text-[11px] font-bold text-amber-600 uppercase block mb-1">
                    Omitidos
                  </span>
                  <span className="text-2xl font-black text-amber-700">
                    {result.summary?.skipped ?? 0}
                  </span>
                </div>
              </div>

              {/* Error Details if any */}
              {result.summary?.errors && result.summary.errors.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                  <span className="text-xs font-bold text-[#E63946] flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Observaciones o Filas con Error ({result.summary.errors.length}):</span>
                  </span>
                  <ul className="text-xs text-rose-700 space-y-1 list-disc list-inside max-h-32 overflow-y-auto">
                    {result.summary.errors.map((errItem, idx) => (
                      <li key={idx}>{errItem}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Drag & Drop File Zone */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                    isDragging
                      ? 'border-[#E63946] bg-red-50/50 scale-[0.99]'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-100/50'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400">
                    <UploadCloud className="w-7 h-7 text-[#E63946]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#584235]">
                      Arrastra tu archivo Excel aquí o <span className="text-[#E63946] underline">haz clic para examinar</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Formatos soportados: .xlsx, .xls, .csv (Máximo 10MB)
                    </p>
                  </div>
                </div>
              ) : (
                /* Selected File Card */
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-bold text-[#584235] truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleRemoveFile}
                    disabled={uploading}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Quitar archivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
                <span className="font-bold text-[#584235] block">💡 Consejo:</span>
                <p>
                  Si aún no tienes el formato estructurado, puedes descargar primero la plantilla oficial con el botón <strong>"Descargar Plantilla"</strong> en la cabecera.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end space-x-3">
          {result ? (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-[#584235] text-xs font-bold transition-all cursor-pointer"
              >
                Importar otro archivo
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer"
              >
                Listo / Cerrar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${uploading ? 'animate-spin' : ''}`} />
                <span>{uploading ? 'Subiendo y procesando...' : 'Importar Archivo'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
