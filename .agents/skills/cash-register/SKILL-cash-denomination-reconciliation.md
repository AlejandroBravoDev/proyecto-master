---
name: cash-register-session-management
description: Guía y estándar arquitectónico para el módulo de Caja en POS, enfocado exclusivamente en el control de apertura (ingreso de base inicial con desglose de monedas y billetes) y cierre de caja (conteo de billetes y monedas al final de la jornada).
---

# Cash Register Session Management - POS Architectural Pattern

Este estándar documenta la implementación del módulo de **Caja** enfocado en el inicio y fin de la jornada operativa.

---

## 🎯 Propósito del Módulo de Caja

1. **Apertura de Caja (Base Inicial para Cambio)**:
   - Al inicio del día/turno, el cajero cuenta físicamente el dinero base que se usará para dar cambio a los primeros clientes.
   - Se registra el desglose por valor facial de cada moneda/billete (`0.10`, `0.50`, `1.00`, `5.00`, etc.) y la cantidad de piezas (`count`).
   - El sistema calcula la base inicial total (`initialAmount = sum(value * count)`).

2. **Cierre de Caja (Conteo Final del Día)**:
   - Al finalizar la jornada, el cajero cuenta físicamente el total de monedas y billetes presentes en la gaveta.
   - Se registra el desglose final y el total físico (`finalAmount = sum(value * count)`).
   - Se archiva la sesión como `CLOSED` con sus respectivas observaciones o notas.

3. **Independencia de Facturación / Cobros**:
   - Este módulo **no procesa cobros ni ventas**. Su única responsabilidad es el registro de apertura (base inicial) y cierre (conteo final) de la gaveta de dinero.

---

## 📐 Estructura de Datos (JSON)

### Formato de Entrada de Denominaciones (Apertura o Cierre)
```json
{
  "denominations": {
    "0.05": 10,
    "0.10": 20,
    "0.25": 8,
    "0.50": 10,
    "1.00": 30,
    "5.00": 10,
    "10.00": 5,
    "20.00": 2
  },
  "notes": "Base inicial para dar cambio a los primeros clientes"
}
```

### Cálculo en Backend (TypeScript / Prisma)
```typescript
function calculateDenominationsTotal(denominations: Record<string, number>): { total: number; normalized: Record<string, number> } {
  let total = 0;
  const normalized: Record<string, number> = {};

  for (const [key, rawCount] of Object.entries(denominations)) {
    const val = parseFloat(key);
    const count = Math.max(0, parseInt(String(rawCount || 0), 10));
    if (!isNaN(val) && val > 0 && count > 0) {
      total += val * count;
      normalized[val.toString()] = count;
    }
  }

  return {
    total: Number(total.toFixed(2)),
    normalized
  };
}
```
