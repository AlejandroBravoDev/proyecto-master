---
name: feature-clean-architecture
description: Guidelines and template for creating frontend feature modules using clean architecture with modular components, a service layer, a central endpoints registry connected to .env (port 3001), and pure JavaScript utils. Use this skill whenever building or refactoring a feature/module in the frontend.
---

# Feature Clean Architecture Skill

This skill defines the mandatory modular architecture for building feature modules in the React/Vite/Electron frontend application.

---

## 📁 Directory Structure Standard

When creating a new feature module inside `src/app/`, create a dedicated parent folder for the feature (e.g. `src/app/<feature_name>/`) containing three mandatory sub-folders:

```
src/app/<feature_name>/
├── components/          # Reusable UI components for this feature only
│   ├── <Feature>Header.jsx
│   └── <Feature>Card.jsx
├── services/            # API call functions & endpoint definitions
│   ├── endpoints.js     # Centralized API URLs registry using .env
│   └── <feature>Service.js # API call handlers (strictly real data, no mockups)
├── utils/               # Pure JavaScript helper functions (no React hooks/JSX)
│   └── formatters.js
└── <Feature>Page.jsx    # Main orchestration page component
```

---

## 🛠️ Step-by-Step Implementation Guide

### 1. Environment & Endpoints Configuration (`services/endpoints.js`)

All API routes must be constructed using `import.meta.env.VITE_API_URL` configured in `frontend/.env`.

**`frontend/.env`**:
```env
VITE_API_URL=http://localhost:3001
```

**`src/app/<feature_name>/services/endpoints.js`**:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const <FEATURE>_ENDPOINTS = {
  MAIN_DATA: `${API_BASE_URL}/api/<feature>/<endpoint_name>`,
};
```

---

### 2. Service Layer (`services/<feature>Service.js`)

- Use `fetch` or `axios` targeting the endpoint constants.
- Do **NOT** use hardcoded mockup/fallback data.
- Throw explicit HTTP errors when status is not `response.ok`.

```javascript
import { <FEATURE>_ENDPOINTS } from './endpoints';

export async function fetch<Feature>Data() {
  const response = await fetch(<FEATURE>_ENDPOINTS.MAIN_DATA, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error en el servidor (${response.status}): No se pudieron obtener los datos.`);
  }

  const data = await response.json();
  
  // Transform & normalize backend payload for components
  return data;
}
```

---

### 3. Pure JavaScript Utilities (`utils/formatters.js`)

Keep component files clean by extracting formatting and calculations into pure JS functions.

```javascript
export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(count) {
  return new Intl.NumberFormat('en-US').format(count);
}
```

---

### 4. Modular UI Components (`components/`)

- Keep components focused on presentation.
- Import formatters from `utils/` and pass structured props.

---

### 5. Main Page Orchestration (`<Feature>Page.jsx`)

- Manage loading state (`loading`).
- Manage real error state (`error`) with a Retry/Reintentar option.
- Call service functions inside `useEffect`.

```javascript
import React, { useEffect, useState, useCallback } from 'react';
import { fetch<Feature>Data } from './services/<feature>Service';

export default function <Feature>Page() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch<Feature>Data()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return <FeatureView data={data} />;
}
```

---

## ✅ Quality Checklist

- [ ] Feature is placed in its own folder: `src/app/<feature_name>/`
- [ ] Subfolders created: `components/`, `services/`, `utils/`
- [ ] Endpoints built dynamically with `VITE_API_URL` in `services/endpoints.js`
- [ ] No hardcoded mock/fake fallback data in `services/`
- [ ] Error handling and Retry logic present in main page component
