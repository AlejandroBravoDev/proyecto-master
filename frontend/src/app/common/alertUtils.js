import Swal from 'sweetalert2';

/**
 * Reusable Confirmation Dialog using SweetAlert2 styled with project palette (#E63946, #584235).
 * Non-blocking, preserves Chromium/Electron focus and avoids event loop locking.
 * 
 * @param {{
 *   title?: string,
 *   text?: string,
 *   confirmButtonText?: string,
 *   cancelButtonText?: string,
 *   icon?: 'warning'|'error'|'info'|'question'
 * }} options
 * @returns {Promise<import('sweetalert2').SweetAlertResult>}
 */
export async function confirmDialog({
  title = '¿Estás seguro?',
  text = 'Esta acción no se puede deshacer.',
  confirmButtonText = 'Sí, eliminar',
  cancelButtonText = 'Cancelar',
  icon = 'warning',
} = {}) {
  return Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonColor: '#E63946',
    cancelButtonColor: '#94a3b8',
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    focusCancel: true,
    customClass: {
      popup: 'rounded-3xl border border-slate-200/80 shadow-2xl font-sans',
      title: 'text-[#584235] font-bold text-lg',
      htmlContainer: 'text-slate-500 text-sm',
      confirmButton: 'rounded-2xl px-5 py-2.5 font-bold text-xs shadow-md shadow-red-500/20 cursor-pointer',
      cancelButton: 'rounded-2xl px-5 py-2.5 font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer',
    },
  });
}

/**
 * Shows an error modal alert.
 * @param {string} title
 * @param {string} text
 */
export async function showErrorAlert(title = 'Error', text = 'Ocurrió un error inesperado.') {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonColor: '#E63946',
    confirmButtonText: 'Entendido',
    customClass: {
      popup: 'rounded-3xl border border-slate-200/80 shadow-2xl font-sans',
      title: 'text-[#E63946] font-bold text-base',
      htmlContainer: 'text-slate-500 text-xs',
      confirmButton: 'rounded-2xl px-5 py-2.5 font-bold text-xs cursor-pointer',
    },
  });
}

/**
 * Shows a quick auto-closing success toast alert.
 * @param {string} title
 */
export function showSuccessToast(title) {
  const Toast = Swal.mixin({
    toast: true,
    position: 'bottom-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: {
      popup: 'rounded-2xl border border-emerald-200 shadow-xl bg-white',
      title: 'text-emerald-700 font-bold text-xs',
    },
  });

  return Toast.fire({
    icon: 'success',
    title,
  });
}
