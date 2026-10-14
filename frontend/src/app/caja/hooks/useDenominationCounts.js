import { useCallback, useEffect, useMemo, useState } from 'react';
import { CASH_DENOMINATIONS, calculateDenominationsTotal } from '../utils/cajaUtils';

/**
 * Builds a counts map with 0 pieces for every denomination, e.g. { "0.05": 0, "1": 0, ... }.
 * @returns {Record<string, number>}
 */
function buildEmptyCounts() {
  const counts = {};
  CASH_DENOMINATIONS.forEach((d) => {
    counts[d.value.toString()] = 0;
  });
  return counts;
}

/**
 * Cash count state shared by the open-cash and close-cash modals: pieces per denomination,
 * their total, and the two ways to edit a count (typing a quantity / quick add buttons).
 * The counts are reset to zero every time the modal opens.
 *
 * @param {boolean} isOpen whether the modal is open
 * @returns {{
 *   denominations: Record<string, number>,
 *   total: number,
 *   setCount: (valStr: string, countStr: string) => void,
 *   quickAdd: (valStr: string, delta: number) => void
 * }}
 */
export function useDenominationCounts(isOpen) {
  const [denominations, setDenominations] = useState({});

  useEffect(() => {
    if (isOpen) {
      setDenominations(buildEmptyCounts());
    }
  }, [isOpen]);

  const total = useMemo(() => calculateDenominationsTotal(denominations), [denominations]);

  const setCount = useCallback((valStr, countStr) => {
    const qty = Math.max(0, parseInt(countStr || '0', 10) || 0);
    setDenominations((prev) => ({
      ...prev,
      [valStr]: qty,
    }));
  }, []);

  const quickAdd = useCallback((valStr, delta) => {
    setDenominations((prev) => {
      const current = prev[valStr] || 0;
      const nextVal = Math.max(0, current + delta);
      return {
        ...prev,
        [valStr]: nextVal,
      };
    });
  }, []);

  return { denominations, total, setCount, quickAdd };
}
