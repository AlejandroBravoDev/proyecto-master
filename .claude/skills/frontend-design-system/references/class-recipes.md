# Recetas de clases (copia y adapta)

Todas salen de componentes existentes (`ProductHeaderCard`, `UserModal`, `UsersTable`, `ProductCard`, `Pagination`, páginas...). Usan los tokens de marca (`brand-red`, `brand-text`, `brand-bg`); en archivos antiguos verás el equivalente `[#E63946]`, `[#584235]`, `[#F8F9FA]`.

## Contenido
- Página y header card
- Botones
- Campos de formulario
- Buscador y filtros (tabs segmentados)
- Badges y estados
- Tarjetas (grilla)
- Tablas
- Estados: cargando, error, vacío
- Modal completo
- Banners de error / aviso dentro de formularios

## Página y header card

```jsx
<div className="space-y-6 max-w-7xl mx-auto pb-8">
  <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold text-brand-text tracking-tight">Título del Módulo</h1>
        <p className="text-slate-400 text-sm mt-1 font-medium">Descripción corta de lo que se gestiona aquí.</p>
      </div>
      <div className="flex items-center gap-3">{/* botones de acción */}</div>
    </div>

    {/* Fila inferior: buscador + filtros */}
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-2 border-t border-slate-100">
      {/* ... */}
    </div>
  </div>
  {/* contenido */}
</div>
```

Variante compacta con icono (`UsersHeader`): título `text-xl md:text-2xl font-black`, cuadro de icono `w-12 h-12 rounded-2xl bg-red-50 text-brand-red`.

## Botones

```jsx
// Primario (acción principal de la pantalla)
<button className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50">
  <Plus className="w-4 h-4" /><span>Nuevo Elemento</span>
</button>

// Secundario
<button className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-brand-text text-xs font-bold transition-all cursor-pointer border border-slate-200">

// Éxito / Excel
<button className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all cursor-pointer border border-emerald-200">

// Advertencia / ajuste (naranja)
<button className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-brand-orange hover:bg-amber-600 text-white text-xs font-bold shadow-lg shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50">

// Cancelar (en el footer de un modal)
<button type="button" className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50">Cancelar</button>

// Botón de icono en fila (editar / peligro)
<button title="Editar" className="p-2 rounded-xl text-slate-400 hover:text-brand-text hover:bg-slate-100 transition-colors cursor-pointer"><Edit3 className="w-4 h-4" /></button>
<button title="Eliminar" className="p-2 rounded-xl text-slate-400 hover:text-brand-red hover:bg-rose-50 transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
```

Botón de guardado con spinner (patrón de todos los modales): icono `RefreshCw` con `className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`}` y texto `{saving ? 'Guardando...' : 'Guardar'}`.

## Campos de formulario

```jsx
<div className="space-y-1.5">
  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
    Nombre <span className="text-brand-red">*</span>
  </label>
  <input
    type="text"
    required
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder="Ej: Hamburguesa con Queso"
    className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg border border-slate-200 text-sm text-brand-text placeholder:text-slate-400 focus:outline-none focus:border-brand-red focus:bg-white transition-all font-medium"
  />
</div>
```

- `select`: mismas clases + `cursor-pointer`. `textarea`: mismas + `resize-none`.
- Dos columnas: `grid grid-cols-1 md:grid-cols-2 gap-4`.
- Input con icono: contenedor `relative`, icono `w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2`, input con `pl-10`.
- Contraseña con ojo: botón `absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600` y input `pr-11`.
- Checkbox: `w-5 h-5 rounded-lg text-brand-red focus:ring-brand-red border-slate-300 cursor-pointer`.
- Campo deshabilitado: `bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed` + pista `text-[10px] text-slate-400`.
- Ayuda bajo el campo: `text-[10px] text-slate-400`.

## Buscador y filtros (tabs segmentados)

```jsx
// Buscador
<div className="relative flex-1 max-w-md">
  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
  <input type="text" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)}
    placeholder="Buscar por nombre..."
    className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-brand-bg border border-slate-200 text-sm text-brand-text placeholder:text-slate-400 focus:outline-none focus:border-brand-red focus:bg-white transition-all font-medium" />
</div>

// Tabs segmentados
<div className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center space-x-1 border border-slate-200 shadow-sm">
  {tabs.map((tab) => {
    const isActive = active === tab.id;
    return (
      <button key={tab.id} onClick={() => onChange(tab.id)}
        className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
          isActive ? 'bg-white text-brand-text shadow-md shadow-slate-300/50' : 'text-slate-500 hover:text-brand-text'
        }`}>
        <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-red' : 'text-slate-400'}`} />
        <span>{tab.label}</span>
        {tab.count > 0 && (
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-brand-red text-white' : 'bg-slate-100 text-slate-600'}`}>{tab.count}</span>
        )}
      </button>
    );
  })}
</div>
```

Contador de resultados: `text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl`.

## Badges y estados

Base: `inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border`

| Significado | Clases de color |
|---|---|
| Éxito / activo / disponible | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| Advertencia / tarde | `bg-amber-50 text-amber-800 border-amber-200` |
| Peligro / agotado / crítico | `bg-rose-50 text-brand-red border-rose-200` |
| Información / venta directa | `bg-blue-50 text-blue-700 border-blue-200` |
| Neutro / cerrado / inactivo | `bg-slate-100 text-slate-600 border-slate-200` |
| Naranja de marca (preparado) | `bg-amber-50 text-brand-orange border-amber-200` |

Punto de estado: `<span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-500" />`. Define los mapas `{ label, badgeClass }` en el `utils` de la feature (ver `PRODUCT_TYPES`, `getStockStatus`).

## Tarjetas (grilla)

Contenedor: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`.

```jsx
<div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative overflow-hidden">
  <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-red" /> {/* franja superior; slate-300 si está inactiva */}
  {/* contenido */}
  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
    <div>
      <span className="text-[10px] font-bold text-slate-400 uppercase block">Precio</span>
      <span className="text-xl font-extrabold text-brand-text">{formatCurrency(value)}</span>
    </div>
    <div className="flex items-center space-x-2">{/* acciones */}</div>
  </div>
</div>
```

Tarjeta inactiva/archivada: `bg-slate-50/40 opacity-80` o `bg-slate-50/30`. Tarjeta KPI (dashboard): franja `h-3 bg-brand-red` arriba, valor `text-3xl font-black`.

## Tablas

```jsx
<div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
  <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
    <table className="w-full text-left border-collapse">
      <thead className="sticky top-0 z-10 bg-slate-50">
        <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <th className="py-4 px-6">Nombre</th>
          <th className="py-4 px-4 text-right">Cantidad</th>
          <th className="py-4 px-6 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-sm font-medium text-brand-text">
        <tr className="hover:bg-slate-50/80 transition-colors">
          <td className="py-4 px-6 font-bold">...</td>
        </tr>
      </tbody>
    </table>
  </div>
  <Pagination currentPage={safePage} totalItems={items.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
</div>
```

Fila vacía: `<td colSpan={n} className="py-12 text-center text-slate-400">No se encontraron registros.</td>`. Números a la derecha (`text-right`), acciones al final.

## Estados: cargando, error, vacío

```jsx
// Cargando (tabla)
<div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 space-y-4 animate-pulse">
  {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="h-12 bg-slate-100 rounded-2xl" />))}
</div>
// Cargando (grilla): <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse"> {6x <div className="h-56 rounded-3xl bg-white border border-slate-200" />}

// Error con reintento
<div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-800 shadow-sm">
  <div className="flex items-center space-x-3">
    <AlertCircle className="w-6 h-6 text-brand-red shrink-0" />
    <div>
      <p className="font-bold text-brand-text">Error al conectar con la API de Proveedores</p>
      <p className="text-xs text-rose-600 mt-0.5">{error}</p>
    </div>
  </div>
  <button onClick={loadData} className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer">
    <RefreshCw className="w-4 h-4" /><span>Reintentar</span>
  </button>
</div>

// Vacío
<div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-12 text-center space-y-3">
  <Truck className="w-12 h-12 text-slate-300 mx-auto" />
  <h3 className="text-base font-bold text-brand-text">No se encontraron proveedores</h3>
  <p className="text-xs text-slate-400 max-w-sm mx-auto">No hay registros con los filtros o el término de búsqueda aplicados.</p>
  {/* CTA solo si el rol puede crear */}
</div>
```

## Modal completo

Ver skill `frontend-modal-form` para la lógica. Estructura visual:

```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-red-50 text-brand-red flex items-center justify-center"><Icon className="w-5 h-5" /></div>
        <div>
          <h2 className="text-lg font-bold text-brand-text">Título</h2>
          <p className="text-xs text-slate-400">Subtítulo</p>
        </div>
      </div>
      <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
    </div>
    {/* Body */}
    <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1"> ... </form>
    {/* Footer (dentro del form): border-t border-slate-100, botones a la derecha con space-x-3 */}
  </div>
</div>
```

Tamaños: `max-w-md` (1-2 campos), `max-w-lg` (formularios), `max-w-2xl`/`max-w-3xl` (con tablas o conteos), `max-w-4xl`/`max-w-5xl` (listados o POS). Franja informativa bajo el header: `px-6 py-4 bg-slate-50 border-b border-slate-100`.

## Banners de error / aviso dentro de formularios

```jsx
// Error de validación o del servidor
<div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-brand-red flex items-center space-x-2.5">
  <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
</div>
// Aviso / tip
<div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-800">...</div>
// Resumen / información neutra
<div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">...</div>
```
