import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, Check, Loader2, X } from 'lucide-react';

/**
 * Reusable Asynchronous Searchable Select (Combobox)
 * 
 * Features:
 * - Lazy load: fetches options only when user clicks/focuses the control.
 * - Debounced live search (~250ms) using loadOptions(searchTerm).
 * - Race-condition safe with active request tracking.
 * - Click-outside & Escape key listeners.
 * - Styled with MasterFood design system (#584235, #E63946, rounded-2xl).
 */
export default function CustomSelect({
  value,
  onChange,
  loadOptions,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Escribe para buscar...',
  initialOption = null,
  getOptionValue = (opt) => opt?.id ?? opt?.value,
  getOptionLabel = (opt) => opt?.name ?? opt?.label,
  renderOption = null,
  disabled = false,
  debounceMs = 250,
  noOptionsMessage = 'No se encontraron resultados',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [selectedOption, setSelectedOption] = useState(initialOption);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const requestIdRef = useRef(0);

  // Sync selectedOption if initialOption changes or when value matches loaded options
  useEffect(() => {
    if (initialOption) {
      setSelectedOption(initialOption);
    }
  }, [initialOption]);

  useEffect(() => {
    if (value !== undefined && value !== null && value !== '') {
      const match = options.find((opt) => String(getOptionValue(opt)) === String(value));
      if (match) {
        setSelectedOption(match);
      }
    } else {
      setSelectedOption(null);
    }
  }, [value, options, getOptionValue]);

  // Fetch options helper with debounce & request tracking
  const executeFetch = useCallback(
    async (term) => {
      if (!loadOptions) return;
      const currentReqId = ++requestIdRef.current;
      setLoading(true);

      try {
        const results = await loadOptions(term);
        // Prevent race condition if newer request finished
        if (currentReqId === requestIdRef.current) {
          setOptions(Array.isArray(results) ? results : []);
          setLoading(false);
          setHasLoadedInitial(true);
        }
      } catch (err) {
        if (currentReqId === requestIdRef.current) {
          setOptions([]);
          setLoading(false);
          setHasLoadedInitial(true);
        }
      }
    },
    [loadOptions]
  );

  // Trigger search on input change with debounce
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeFetch(term);
    }, debounceMs);
  };

  // Open dropdown and load options if not loaded yet
  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearchTerm('');

    // Focus input after dropdown opens
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    // Only fetch on first open or refresh search
    if (!hasLoadedInitial) {
      executeFetch('');
    } else {
      executeFetch('');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleSelect = (option) => {
    setSelectedOption(option);
    handleClose();
    if (onChange) {
      onChange(getOptionValue(option), option);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedOption(null);
    if (onChange) {
      onChange('', null);
    }
  };

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        handleClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isOpen]);

  const displayLabel = selectedOption
    ? getOptionLabel(selectedOption)
    : placeholder;

  const isSelected = selectedOption !== null && selectedOption !== undefined && value !== '';

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-[#E63946] ring-2 ring-[#E63946]/10 shadow-xs'
            : isSelected
            ? 'bg-white border-slate-200 text-[#584235] hover:border-slate-300'
            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
        }`}
      >
        <span className={`truncate mr-2 ${isSelected ? 'font-bold text-[#584235]' : 'text-slate-400 font-medium'}`}>
          {displayLabel}
        </span>

        <div className="flex items-center space-x-1 shrink-0 text-slate-400">
          {isSelected && !disabled && (
            <span
              role="button"
              onClick={handleClear}
              title="Borrar selección"
              className="p-0.5 rounded-md hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#E63946]' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-64 animate-fade-in">
          {/* Search Input Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/60 sticky top-0 z-10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] font-medium"
              />
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 text-[#E63946] animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
              ) : searchTerm ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    executeFetch('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 p-1 divide-y divide-slate-50">
            {loading && options.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 text-[#E63946] animate-spin" />
                <span>Cargando opciones...</span>
              </div>
            ) : options.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                {noOptionsMessage}
              </div>
            ) : (
              options.map((option) => {
                const optVal = getOptionValue(option);
                const isItemActive = String(optVal) === String(value);

                return (
                  <div
                    key={optVal}
                    onClick={() => handleSelect(option)}
                    className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      isItemActive
                        ? 'bg-red-50 text-[#E63946] font-bold'
                        : 'text-[#584235] hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="truncate flex-1 mr-2">
                      {renderOption ? (
                        renderOption(option, isItemActive)
                      ) : (
                        <span>{getOptionLabel(option)}</span>
                      )}
                    </div>

                    {isItemActive && (
                      <Check className="w-3.5 h-3.5 text-[#E63946] shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
