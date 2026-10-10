---
name: frontend-data-views
description: Listados del frontend - grillas de tarjetas o tablas con buscador, filtros y tabs, paginación (componente Pagination, 15 por página) y los tres estados cargando/error/vacío; también tarjetas KPI. Úsala siempre que haya que mostrar una colección de datos, agregar un filtro, buscador, tab, paginación u ordenamiento a una pantalla.
---

# Frontend: listados (tarjetas, tablas, filtros, paginación)

Toda pantalla de datos de MasterFood resuelve las mismas cuatro cosas: **traer, filtrar, paginar y mostrar tres estados**. Las plantillas están en `references/templates.md` (header card con buscador, tabla paginada, grilla de tarjetas, página que lo orquesta). Estilos: `frontend-design-system`.

## 1. Elegir la vista

| Datos | Vista | Modelo real |
|---|---|---|
| Pocos campos por registro, mucha comparación (usuarios, insumos, historial) | **Tabla** | `UsersTable`, `IngredientTable`, `SessionHistoryTable` |
| Registros "con personalidad", imagen/precio/estado, acciones por tarjeta (productos, comandas) | **Grilla de tarjetas** | `ProductCard`, `OrderCard` |
| Métricas agregadas | **Tarjetas KPI** + widgets | `MetricCard`, `TopProductsWidget` |

## 2. Carga y filtrado

- La **página** mantiene `items`, `loading`, `error` y llama al service dentro de `loadData = useCallback(...)` + `useEffect(() => { loadData(); }, [loadData])`. Para datos secundarios opcionales (categorías, alertas) usa `Promise.all([principal(), secundario().catch(() => [])])` para que un fallo no secundario no tumbe la pantalla.
- **Filtrado en cliente** con `useMemo` (la API devuelve la lista completa): búsqueda `includes` en minúsculas sobre nombre/descripción/código; tabs/estados con comparación de `String(a) === String(b)` para ids; combina todo en un solo `filter`.
- Los controles de filtro viven en la *header card* (controlados por props); el estado vive en la página.
- Cuando el filtro depende del rol (p. ej. el historial completo solo para admin) calcula `queryFilters` con `useMemo` según `isAdmin` y pásalo a `loadData` (`useCallback([queryFilters])`).
- Estado en la URL cuando otra pantalla debe enlazar a una vista filtrada (`/inventario?tab=alerts`): `useSearchParams`, y limpia el parámetro al cambiar de tab manualmente (ver `InventoryPage`).

## 3. Paginación

- Componente común: `import Pagination, { ITEMS_PER_PAGE } from '../../common/Pagination';` (`ITEMS_PER_PAGE = 15`). Se renderiza dentro del contenedor de la tabla, con `currentPage`, `totalItems`, `itemsPerPage`, `onPageChange`. Se oculta solo si `totalItems <= 0`.
- Se pagina **en cliente**: `safePage = Math.min(Math.max(1, page), totalPages)` y `items.slice((safePage-1)*N, safePage*N)` dentro de `useMemo`.
- **Vuelve a la página 1** cuando cambie el buscador o un filtro (`useEffect(() => setCurrentPage(1), [searchTerm, activeFilter])`); si no, puedes quedar en una página que ya no existe.
- Si el backend no pagina, no finjas paginación de servidor (hoy `GET /api/users` ignora `page/limit`). Cuando los volúmenes lo exijan, implementa paginación en backend (`{ total, page, limit, totalPages, items }`, ver `backend-new-module`) y deja de rebanar en el cliente.
- No dupliques la paginación: `UsersTable` trae una propia por historia; en código nuevo usa `Pagination`.

## 4. Los tres estados (siempre)

Orden de decisión en el JSX de la página: `loading` -> `error` -> `vacío` -> contenido. Las recetas (skeleton `animate-pulse`, tarjeta de error con "Reintentar", estado vacío con icono y CTA solo si el rol puede crear) están en `frontend-design-system`. Un vacío por filtros debe decir que no hay resultados *para esos filtros*; un vacío real invita a crear el primero.

## 5. Detalles que evitan bugs

- `key` estable con el `id` del registro (no el índice).
- Acciones por fila reciben el **objeto** (`onEdit(item)`), no el id, así la página no tiene que buscarlo.
- Acciones que dependen del rol se ocultan con `isAdmin` (prop con default explícito). Recuerda que es solo UI.
- Cifras alineadas a la derecha (`text-right`), fechas con el `formatDate` del `utils`, dinero con `formatCurrency`.
- Textos largos: `truncate` / `line-clamp-2`; tablas dentro de `overflow-x-auto`.
- Evita `useEffect` que dependa de un arreglo recreado en cada render (provoca bucles): memoriza con `useMemo`.
- Interacción no destructiva (marcar disponible, activar) puede ser optimista, pero siempre termina en `loadData()` para reflejar el servidor.

## Terminado cuando

- [ ] Se ven bien los 3 estados (apaga el backend para ver el error; usa un filtro sin coincidencias para el vacío).
- [ ] Buscar/filtrar reinicia la paginación; con > 15 registros navegar páginas funciona.
- [ ] A 768 px: la tabla hace scroll horizontal dentro de su tarjeta (no de la página) y la header card se apila.
- [ ] Rol sin permisos no ve acciones de escritura.
- [ ] `npm run build` sin errores.
