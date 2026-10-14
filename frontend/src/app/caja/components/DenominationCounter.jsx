import React from 'react';
import { Banknote, Coins } from 'lucide-react';
import { CASH_DENOMINATIONS, formatCurrency } from '../utils/cajaUtils';

const COINS = CASH_DENOMINATIONS.filter((d) => d.type === 'COIN');
const BILLS = CASH_DENOMINATIONS.filter((d) => d.type === 'BILL');

// Monedas se suman de 5 en 5 y billetes de 1 en 1 con los botones rápidos.
const COIN_STEP = 5;
const BILL_STEP = 1;

function DenominationColumn({ icon: Icon, iconClass, title, items, step, denominations, onCountChange, onQuickAdd }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 text-xs font-extrabold text-[#584235] border-b border-slate-100 pb-1.5">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <span>{title}</span>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const valKey = item.value.toString();
          const count = denominations[valKey] || 0;
          const rowSubtotal = item.value * count;

          return (
            <div
              key={valKey}
              className="flex items-center justify-between p-2 rounded-xl bg-[#F8F9FA] border border-slate-200/80 text-xs"
            >
              <span className="font-black text-[#584235] w-12">{item.label}</span>

              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => onQuickAdd(valKey, -step)}
                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center text-[10px] cursor-pointer"
                  title={`Restar ${step}`}
                >
                  -{step}
                </button>
                <input
                  type="number"
                  min="0"
                  value={count === 0 ? '' : count}
                  onChange={(e) => onCountChange(valKey, e.target.value)}
                  placeholder="0"
                  className="w-14 px-2 py-1 rounded-lg bg-white border border-slate-300 text-center font-bold text-slate-800 text-xs focus:outline-none focus:border-[#E63946]"
                />
                <button
                  type="button"
                  onClick={() => onQuickAdd(valKey, step)}
                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center text-[10px] cursor-pointer"
                  title={`Sumar ${step}`}
                >
                  +{step}
                </button>
              </div>

              <span className="font-bold text-slate-500 w-16 text-right">{formatCurrency(rowSubtotal)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Cuadrícula de conteo de efectivo (monedas y billetes) de la apertura y el cierre de caja.
 * Es "tonta": el estado vive en `useDenominationCounts`.
 *
 * @param {{
 *   denominations: Record<string, number>,
 *   onCountChange: (valStr: string, countStr: string) => void,
 *   onQuickAdd: (valStr: string, delta: number) => void,
 *   coinsTitle?: string,
 *   billsTitle?: string
 * }} props
 */
export default function DenominationCounter({
  denominations,
  onCountChange,
  onQuickAdd,
  coinsTitle = 'Monedas',
  billsTitle = 'Billetes',
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <DenominationColumn
        icon={Coins}
        iconClass="text-amber-500"
        title={coinsTitle}
        items={COINS}
        step={COIN_STEP}
        denominations={denominations}
        onCountChange={onCountChange}
        onQuickAdd={onQuickAdd}
      />
      <DenominationColumn
        icon={Banknote}
        iconClass="text-emerald-600"
        title={billsTitle}
        items={BILLS}
        step={BILL_STEP}
        denominations={denominations}
        onCountChange={onCountChange}
        onQuickAdd={onQuickAdd}
      />
    </div>
  );
}
