import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, RefreshCw, UtensilsCrossed, Plus } from 'lucide-react';
import ProductHeaderCard from './components/ProductHeaderCard';
import CategoryFilterBar from './components/CategoryFilterBar';
import ProductCard from './components/ProductCard';
import ProductModal from './components/ProductModal';
import CategoryModal from './components/CategoryModal';
import {
  fetchProducts,
  fetchCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  saveProductRecipe,
} from './services/productService';
import { confirmDialog, showErrorAlert, showSuccessToast } from '../common/alertUtils';
import { useAuth } from '../auth/AuthContext';

export default function ProductsPage() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');

  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // Load all products and categories
  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([fetchProducts(), fetchCategories().catch(() => [])])
      .then(([prodData, catData]) => {
        setProducts(Array.isArray(prodData) ? prodData : []);
        setCategories(Array.isArray(catData) ? catData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando productos:', err);
        setError(err.message || 'No se pudo conectar con el servidor para cargar los productos.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Product Counts per category
  const productCounts = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      if (p.categoryId) {
        counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      // Search term
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Category filter
      if (activeCategory !== 'all' && String(item.categoryId) !== String(activeCategory)) {
        return false;
      }

      // Availability filter
      if (availabilityFilter === 'available' && !item.available) {
        return false;
      }
      if (availabilityFilter === 'unavailable' && item.available) {
        return false;
      }

      return true;
    });
  }, [products, searchTerm, activeCategory, availabilityFilter]);

  // Modal Handlers
  const handleOpenCreateProduct = () => {
    if (!isAdmin) return;
    setSelectedProduct(null);
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (item) => {
    if (!isAdmin) return;
    setSelectedProduct(item);
    setProductModalOpen(true);
  };

  // El modal envía el producto y, si cambió, la receta (`recipe`). Al crear, el backend la guarda
  // junto con el producto; al editar, la receta se reemplaza aparte con POST /api/recipes.
  // Si algo falla se relanza el error: el modal lo muestra en su banner y no se cierra.
  const handleSaveProduct = async (formData) => {
    if (selectedProduct) {
      const { recipe, ...productData } = formData;
      await updateProduct(selectedProduct.id, productData);

      if (recipe) {
        try {
          await saveProductRecipe(selectedProduct.id, recipe);
        } catch (err) {
          // El producto ya se guardó: refresca el listado para que no quede desactualizado.
          loadData();
          throw new Error(`Los datos del producto se guardaron, pero la receta no: ${err.message}`);
        }
      }
      showSuccessToast('Producto actualizado correctamente.');
    } else {
      await createProduct(formData);
      showSuccessToast('Producto creado exitosamente.');
    }
    loadData();
  };

  const handleToggleAvailability = async (id, newAvailability) => {
    try {
      await updateProduct(id, { available: newAvailability });
      showSuccessToast(newAvailability ? 'Producto marcado como disponible.' : 'Producto marcado como agotado.');
      loadData();
    } catch (err) {
      showErrorAlert('Error al cambiar disponibilidad', err.message || 'No se pudo actualizar el producto.');
    }
  };

  const handleDeleteProduct = async (item) => {
    if (!isAdmin) return;
    const result = await confirmDialog({
      title: `¿Eliminar "${item.name}"?`,
      text:
        'El producto se eliminará definitivamente del menú. Si ya tiene historial de comandas o ventas, ' +
        'el sistema no permitirá eliminarlo: en ese caso márcalo como "No Disponible" (Agotado) para quitarlo ' +
        'de la venta sin perder el historial.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        await deleteProduct(item.id);
        showSuccessToast('Producto eliminado del menú.');
        loadData();
      } catch (err) {
        // Muestra el motivo real del servidor (p. ej. "tiene historial; desactívalo en lugar de eliminarlo").
        showErrorAlert('No se pudo eliminar el producto', err.message || 'No se pudo eliminar el producto.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* TOP SWITCHER: Category Filter Bar */}
      <CategoryFilterBar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        productCounts={productCounts}
      />

      {/* CONTAINER 1: Header Card */}
      <ProductHeaderCard
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        availabilityFilter={availabilityFilter}
        onAvailabilityFilterChange={setAvailabilityFilter}
        onNewProductClick={handleOpenCreateProduct}
        onManageCategoriesClick={() => setCategoryModalOpen(true)}
        isAdmin={isAdmin}
      />

      {/* CONTAINER 2: Products Grid / States */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-56 rounded-3xl bg-white border border-slate-200" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-800 shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-[#E63946] shrink-0" />
            <div>
              <p className="font-bold text-[#584235]">Error al conectar con la API de Productos</p>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-12 text-center space-y-3">
          <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-[#584235]">No se encontraron productos</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No hay productos registrados con los filtros o término de búsqueda aplicados.
          </p>
          {isAdmin && (
            <div className="pt-2">
              <button
                onClick={handleOpenCreateProduct}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Primer Producto</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={handleOpenEditProduct}
              onDelete={handleDeleteProduct}
              onToggleAvailability={handleToggleAvailability}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Modal: Create/Edit Product */}
      {isAdmin && (
        <ProductModal
          isOpen={productModalOpen}
          onClose={() => setProductModalOpen(false)}
          onSubmit={handleSaveProduct}
          categories={categories}
          initialData={selectedProduct}
        />
      )}

      {/* Modal: Manage Categories */}
      {isAdmin && (
        <CategoryModal
          isOpen={categoryModalOpen}
          onClose={() => setCategoryModalOpen(false)}
          categories={categories}
          onCategoriesChanged={loadData}
        />
      )}
    </div>
  );
}

