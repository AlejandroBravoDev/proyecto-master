---
name: frontend-design-system
description: Sistema visual de MasterFood en Tailwind 4 - colores de marca, tipografía y recetas de clases para tarjetas, botones, inputs, badges, tablas, modales, tabs segmentados y estados vacío/error/skeleton. Úsala SIEMPRE que escribas o cambies cualquier UI del frontend (página, componente, modal, formulario) para que quede idéntica en estilo al resto de la app, aunque el usuario no hable de diseño.
---

# Frontend: sistema de diseño MasterFood

La app tiene una identidad muy consistente (tarjetas blancas muy redondeadas, rojo de marca, texto marrón, tipografía Istok Web). La consistencia es lo que hace que cada módulo nuevo se sienta parte del mismo producto, así que **no inventes estilos**: toma las recetas de `references/class-recipes.md` y adáptalas.

## Identidad

| Token (`src/index.css` `@theme`) | Valor | Clase Tailwind | Uso |
|---|---|---|---|
| `--color-brand-red` | `#E63946` | `bg-brand-red`, `text-brand-red` | acción primaria, errores, críticos, foco |
| `--color-brand-orange` | `#FF7A00` | `bg-brand-orange` | ajustes, recetas, alertas medias |
| `--color-brand-text` | `#584235` | `text-brand-text` | texto principal, títulos |
| `--color-brand-bg` | `#F8F9FA` | `bg-brand-bg` | fondo de página y de inputs |
| `--color-sidebar-bg` | `#2E3132` | `bg-sidebar-bg` | barra lateral, banners oscuros |
| `--font-istok` | Istok Web | `font-istok` | tipografía (también aplicada al `body`) |

Los archivos antiguos escriben los mismos colores como valores arbitrarios (`bg-[#E63946]`, `text-[#584235]`, `bg-[#F8F9FA]`) y se ven igual. En archivos **nuevos** usa los tokens (un solo lugar para re-tematizar); si editas un archivo que usa hex, respeta su estilo y no lo conviertas sin que te lo pidan.

Colores semánticos (Tailwind estándar): **emerald** = éxito/abierto/disponible/entradas; **amber** = advertencia/tarde; **rose** = error/peligro/salidas; **blue** = información/venta directa; **slate** = neutro. Rojo de marca para lo principal y destructivo.

## Reglas de composición

1. **Página**: contenedor `space-y-6 max-w-7xl mx-auto pb-8`; primero una *header card* (título, subtítulo, acción principal, buscador/filtros) y debajo el contenido (grilla de tarjetas o tabla).
2. **Tarjetas y paneles**: `bg-white rounded-3xl border border-slate-200/80 shadow-sm`. Controles internos usan `rounded-2xl` (inputs, botones) o `rounded-xl` (chips, botones de icono).
3. **Tipografía**: títulos `font-extrabold tracking-tight text-brand-text`; etiquetas de campo `text-xs font-bold uppercase tracking-wider`; cifras y totales `font-black`; texto secundario `text-slate-400`. Todo el texto visible en **español**.
4. **Botones**: texto `text-xs font-bold`, icono lucide `w-4 h-4`, **siempre `cursor-pointer`** (Tailwind 4 ya no lo aplica a `<button>`), `disabled:opacity-50` y `type="button"` en botones que no envían el formulario.
5. **Estados obligatorios** en toda pantalla de datos: cargando (skeleton `animate-pulse`), error (tarjeta rosa con "Reintentar"), vacío (icono + título + pista + CTA si el rol puede crear).
6. **Responsive**: la app está pensada para **tablet (>= 768 px) y escritorio**: el `Sidebar` es fijo (`w-64`, o `w-20` colapsado) y no hay menú móvil, y `index.html` no declara `<meta name="viewport">` (un teléfono renderiza a 980 px y no activa los breakpoints). Escribe las clases en orden base -> `sm:` -> `md:` -> `lg:` (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, filas `flex-col md:flex-row`) y mete las tablas en `overflow-x-auto`; comprueba a 768 px y a 1280 px. Soporte de móvil real sería un cambio global propio (viewport meta + sidebar colapsable).
7. **Iconos**: `lucide-react` (verifica que el nombre exista: un import inexistente rompe el build). En el título de un modal, un cuadro `w-9 h-9 rounded-xl` con el icono `w-5 h-5`.
8. **Moneda**: usa el `formatCurrency` del `utils` de la feature. Ojo: hoy hay dos locales (`es-CO` -> "US$ 7,50" y `en-US` -> "$7.50"); en una feature nueva copia el de la feature más parecida y no mezcles dos formatos en la misma pantalla.

## Animaciones: brecha conocida

`animate-fade-in`, `animate-slide-up` y `animate-shake` aparecen en ~19 archivos pero **no están definidas**, así que no hacen nada (solo `animate-spin`, `animate-pulse` y `animate-ping` existen). Para activarlas, define en `frontend/src/index.css` dentro de `@theme` (Tailwind 4) -- solo si el usuario lo pide, es un cambio global:

```css
@theme {
  --animate-fade-in: fade-in 0.2s ease-out;
  --animate-slide-up: slide-up 0.25s ease-out;
  --animate-shake: shake 0.4s ease-in-out;

  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
}
```

Mientras no existan, no dependas de ellas para comunicar nada importante.

## Antes de dar por terminada una UI

- [ ] Reutiliza recetas de `references/class-recipes.md` (misma redondez, bordes, sombras, paleta).
- [ ] Estados cargando / error con reintento / vacío presentes.
- [ ] Botones con `cursor-pointer`, `type` correcto, `disabled` durante guardados, `title` en botones solo-icono.
- [ ] Probado a 768 px (tablet) y 1280 px (escritorio); sin scroll horizontal de la **página** (las tablas hacen scroll dentro de su tarjeta).
- [ ] Textos en español; sin colores hex nuevos fuera de la paleta.
- [ ] `npm run build` en `frontend/` sin errores.
