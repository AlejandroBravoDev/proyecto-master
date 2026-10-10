---
name: frontend-new-feature
description: Crea un módulo o pantalla nueva del frontend React - una carpeta por feature en src/app con Page, components, services (endpoints.js), utils, ruta en router.jsx y entrada en el Sidebar, con control de roles. Úsala SIEMPRE que pidan una página, pantalla, sección, módulo o menú nuevo del frontend, o conectar la UI a un endpoint nuevo, aunque no mencionen carpetas ni el router.
---

# Frontend: feature / pantalla nueva

Cada módulo de la app es una carpeta autocontenida en `frontend/src/app/<feature>/` con la misma forma. Seguirla hace que cualquiera encuentre cada cosa donde espera y que las piezas (servicios, modales, tablas) se puedan reutilizar con el mismo contrato. Plantillas completas de la página, router y sidebar en `references/page-template.md`.

## Estructura

```
frontend/src/app/<feature>/            carpeta en inglés, minúscula (products, orders, caja, suppliers)
├── <Feature>Page.jsx                  orquesta: estado, carga, modales, handlers
├── components/
│   ├── <Feature>HeaderCard.jsx        título, acción principal, buscador/filtros
│   ├── <Feature>Table.jsx | <Feature>Card.jsx
│   └── <Feature>Modal.jsx             (+ otros modales)
├── services/
│   ├── endpoints.js                   URLs con getApiBaseUrl()      -> frontend-api-service
│   └── <feature>Service.js            funciones fetch               -> frontend-api-service
└── utils/<feature>Utils.js            JS puro: formateadores, constantes, mapas de etiquetas
```

Archivos de componentes en PascalCase, services/utils en camelCase. Ruta de URL y etiqueta del menú en **español** (`/proveedores`, "Proveedores"); carpeta, archivos e identificadores en inglés.

## Pasos

1. **Define** la feature: nombre, ruta, icono lucide, quién la ve (todos / solo admin), qué endpoints usa. Si el backend aún no existe, hazlo primero (`backend-new-module`) o acuerda el contrato en `fullstack-domain-reference/references/api-endpoints.md`.
2. **`services/`**: `endpoints.js` y `<feature>Service.js` (skill `frontend-api-service`).
3. **`utils/`**: constantes y formateadores puros (sin hooks ni JSX): mapas `{ label, badgeClass }` para estados, `formatCurrency`/`formatDate` locales, validadores. Mantén en `utils/` todo cálculo que no necesite React.
4. **`components/`**: presentacionales y controlados por props; no llaman a `fetch`.
   - header card + listado -> `frontend-data-views`
   - modal crear/editar -> `frontend-modal-form`
   - estilos -> `frontend-design-system`
5. **`<Feature>Page.jsx`**: orquestación (ver reglas abajo).
6. **Ruta** en `app/router.jsx` (dentro de `children` de `/`), y `ProtectedRoute adminOnly` si es solo admin.
7. **Menú** en `app/layouts/Sidebar.jsx`: nuevo ítem en `navItems` con icono de `lucide-react` (condicional a `isAdmin` si aplica).
8. **Verifica**: `npm run build` en `frontend/`, abre la pantalla con el backend corriendo y recorre crear / editar / eliminar / vacío / error (backend apagado) y ambos roles.
9. **Documenta** lo que cambie en la API y actualiza las referencias si el módulo añade reglas de negocio.

## Reglas de la página (`<Feature>Page.jsx`)

- Estado: `items`, `loading` (inicia `true`), `error`, filtros, y por cada modal `xxxModalOpen` + `selectedXxx`.
- `loadData = useCallback(() => { setLoading(true); setError(null); service().then(set...).catch(setError) }, [])` y `useEffect(() => { loadData(); }, [loadData])`. Mensaje de error de respaldo: `'No se pudo conectar con el servidor para cargar ...'`.
- Render en este orden: `loading` (skeleton) -> `error` (tarjeta + Reintentar) -> vacío -> contenido. Los modales se montan siempre al final (se auto-ocultan con `isOpen`).
- Handlers de escritura en la página: `handleSave` (crear/editar), `handleDelete` (con `confirmDialog`), acciones de estado. Tras éxito: `showSuccessToast(...)` y `loadData()`. Errores: `showErrorAlert` o el banner del modal (`frontend-alerts-dialogs`).
- Roles: `const { isAdmin } = useAuth();` (de `../auth/AuthContext`) y pasa `isAdmin` a header/tabla/tarjetas con default explícito; oculta crear/editar/eliminar si no es admin. Si **toda** la pantalla es solo admin, protege además la ruta. Es restricción de interfaz, no de seguridad (el servidor no valida roles).
- `useEffect`/`useCallback` con dependencias completas; nada de `fetch` ni URLs en la página.
- Mensajes y textos de UI en español; comentarios/JSDoc en inglés.

## Registro de ruta y menú (resumen)

```jsx
// router.jsx
import SuppliersPage from './suppliers/SuppliersPage';
{ path: 'proveedores', element: <SuppliersPage /> },
// solo admin:
{ path: 'proveedores', element: (<ProtectedRoute adminOnly><SuppliersPage /></ProtectedRoute>) },

// Sidebar.jsx
import { Truck } from 'lucide-react';
{ name: 'Proveedores', path: '/proveedores', icon: Truck },
// solo admin: ...(isAdmin ? [{ name: 'Proveedores', path: '/proveedores', icon: Truck }] : []),
```

El router es `createHashRouter`: la URL real es `/#/proveedores`. El ítem activo del menú compara `location.pathname === item.path`.

## Errores típicos

- Olvidar registrar ruta **y** menú (la pantalla existe pero no se llega a ella).
- `if (!isOpen) return null` antes de un hook en un modal (rompe las reglas de hooks).
- Armar URLs con `import.meta.env` o a mano (rompe en producción) -> usa `getApiBaseUrl()` vía `endpoints.js`.
- Mostrar datos inventados cuando falla la API: se muestra el estado de error, nunca valores de respaldo.
- Importar el service de otra feature en vez de declarar el endpoint en la propia.

## Terminado cuando

- [ ] Carpeta con `services/`, `components/`, `utils/` y la Page; sin `fetch` fuera de `services/`.
- [ ] Ruta y entrada de menú registradas; rol correcto en ambas.
- [ ] Estados cargando / error con Reintentar / vacío verificados; crear, editar y eliminar probados con el backend real.
- [ ] `npm run build` sin errores; `node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs` sin hallazgos nuevos.
