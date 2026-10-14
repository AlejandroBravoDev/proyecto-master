/**
 * ====================================================
 * CONTROLADOR DE PRODUCTOS (CONTROLLER LAYER)
 * ====================================================
 * Atiende las peticiones HTTP relativas a productos y recetas asociadas.
 */

import { Request, Response } from 'express';
import { ProductType } from '@prisma/client';
import { productService } from '../services/product.service';
import {
  errorDetails,
  parseId,
  parseOptionalText,
  parseRequiredText,
  toFiniteNumber
} from '../utils/http.utils';
import { parseRecipeIngredients, RecipeIngredientInput } from '../utils/recipe.utils';

/** Valores válidos de `productType` (enum de Prisma). */
const PRODUCT_TYPES: string[] = Object.values(ProductType);

const PRODUCT_TYPES_HINT = `El tipo de producto debe ser ${PRODUCT_TYPES.join(' o ')}`;

export class ProductController {
  /**
   * GET /api/products
   * Retorna la lista de productos filtrada según parámetros de query.
   */
  async getProducts(req: Request, res: Response) {
    try {
      const { categoryId, available, productType } = req.query;

      let parsedCategoryId: number | undefined;
      if (categoryId !== undefined && categoryId !== '') {
        const parsed = parseId(categoryId);
        if (parsed === null) {
          return res.status(400).json({ error: 'categoryId inválido' });
        }
        parsedCategoryId = parsed;
      }
      if (productType !== undefined && productType !== '' && !PRODUCT_TYPES.includes(String(productType))) {
        return res.status(400).json({ error: PRODUCT_TYPES_HINT });
      }

      const products = await productService.getProducts({
        categoryId: parsedCategoryId,
        available: available !== undefined ? available === 'true' : undefined,
        productType: productType ? String(productType) : undefined
      });

      return res.json(products);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener productos', details: errorDetails(error) });
    }
  }

  /**
   * GET /api/products/:id
   * Retorna el detalle del producto solicitado.
   */
  async getProductById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const product = await productService.getProductById(id);

      if (!product) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      return res.json(product);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener el producto', details: errorDetails(error) });
    }
  }

  /**
   * POST /api/products
   * Valida la entrada y registra un nuevo producto en el sistema.
   */
  async createProduct(req: Request, res: Response) {
    try {
      const { categoryId, name, description, salePrice, image, available, productType, recipe } = req.body ?? {};

      const parsedCategoryId = parseId(categoryId);
      const trimmedName = parseRequiredText(name);
      const parsedPrice = toFiniteNumber(salePrice);

      if (parsedCategoryId === null || trimmedName === null || parsedPrice === null) {
        return res.status(400).json({ error: 'categoryId, name y salePrice son obligatorios' });
      }
      if (parsedPrice < 0) {
        return res.status(400).json({ error: 'El precio de venta debe ser un número mayor o igual a 0' });
      }

      const parsedDescription = parseOptionalText(description);
      const parsedImage = parseOptionalText(image);
      if (!parsedDescription.valid || !parsedImage.valid) {
        return res.status(400).json({ error: 'La descripción y la imagen deben ser texto' });
      }
      if (available !== undefined && typeof available !== 'boolean') {
        return res.status(400).json({ error: 'El campo "available" debe ser booleano' });
      }
      if (productType !== undefined && !PRODUCT_TYPES.includes(productType)) {
        return res.status(400).json({ error: PRODUCT_TYPES_HINT });
      }

      // Receta opcional anidada: { name?, ingredients: [{ ingredientId, quantity, measurementUnit }] }
      let parsedRecipe: { name?: string; ingredients: RecipeIngredientInput[] } | undefined;
      if (recipe !== undefined && recipe !== null) {
        if (typeof recipe !== 'object' || Array.isArray(recipe)) {
          return res.status(400).json({ error: 'recipe debe ser un objeto con la lista de ingredients' });
        }
        if (recipe.ingredients !== undefined) {
          const parsedIngredients = parseRecipeIngredients(recipe.ingredients);
          if ('error' in parsedIngredients) {
            return res.status(400).json({ error: parsedIngredients.error });
          }
          const parsedRecipeName = parseOptionalText(recipe.name);
          if (!parsedRecipeName.valid) {
            return res.status(400).json({ error: 'El nombre de la receta debe ser texto' });
          }
          parsedRecipe = {
            name: parsedRecipeName.value ?? undefined,
            ingredients: parsedIngredients.ingredients
          };
        }
      }

      const product = await productService.createProduct({
        categoryId: parsedCategoryId,
        name: trimmedName,
        description: parsedDescription.value,
        salePrice: parsedPrice,
        image: parsedImage.value,
        available,
        productType,
        recipe: parsedRecipe
      });

      return res.status(201).json(product);
    } catch (error: any) {
      if (error.message === 'CATEGORY_NOT_FOUND') {
        return res.status(400).json({ error: 'La categoría indicada no existe' });
      }
      if (error.message?.startsWith('INGREDIENT_NOT_FOUND:')) {
        return res.status(400).json({ error: `El insumo con ID ${error.message.split(':')[1]} de la receta no existe` });
      }
      return res.status(500).json({ error: 'Error al crear el producto', details: errorDetails(error) });
    }
  }

  /**
   * PUT /api/products/:id
   * Modifica las propiedades de un producto. Los campos omitidos no cambian;
   * `description: null` (o texto vacío) y `image: null` limpian el campo.
   */
  async updateProduct(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { categoryId, name, description, salePrice, image, available, productType } = req.body ?? {};

      const data: Parameters<typeof productService.updateProduct>[1] = {};

      if (categoryId !== undefined) {
        const parsedCategoryId = parseId(categoryId);
        if (parsedCategoryId === null) {
          return res.status(400).json({ error: 'categoryId inválido' });
        }
        data.categoryId = parsedCategoryId;
      }
      if (name !== undefined) {
        const trimmedName = parseRequiredText(name);
        if (trimmedName === null) {
          return res.status(400).json({ error: 'El nombre del producto no puede estar vacío' });
        }
        data.name = trimmedName;
      }
      if (salePrice !== undefined) {
        const parsedPrice = toFiniteNumber(salePrice);
        if (parsedPrice === null || parsedPrice < 0) {
          return res.status(400).json({ error: 'El precio de venta debe ser un número mayor o igual a 0' });
        }
        data.salePrice = parsedPrice;
      }

      const parsedDescription = parseOptionalText(description);
      const parsedImage = parseOptionalText(image);
      if (!parsedDescription.valid || !parsedImage.valid) {
        return res.status(400).json({ error: 'La descripción y la imagen deben ser texto' });
      }
      if (parsedDescription.value !== undefined) data.description = parsedDescription.value;
      if (parsedImage.value !== undefined) data.image = parsedImage.value;

      if (available !== undefined) {
        if (typeof available !== 'boolean') {
          return res.status(400).json({ error: 'El campo "available" debe ser booleano' });
        }
        data.available = available;
      }
      if (productType !== undefined) {
        if (!PRODUCT_TYPES.includes(productType)) {
          return res.status(400).json({ error: PRODUCT_TYPES_HINT });
        }
        data.productType = productType;
      }

      const updated = await productService.updateProduct(id, data);
      return res.json(updated);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      if (error.message === 'CATEGORY_NOT_FOUND') {
        return res.status(400).json({ error: 'La categoría indicada no existe' });
      }
      return res.status(500).json({ error: 'Error al actualizar el producto', details: errorDetails(error) });
    }
  }

  /**
   * DELETE /api/products/:id
   * Elimina un producto sin historial. Con comandas o ventas asociadas responde 400:
   * debe desactivarse (`available: false`) en lugar de eliminarse.
   */
  async deleteProduct(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await productService.deleteProduct(id);
      return res.json({ message: 'Producto eliminado correctamente' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      if (error.message === 'PRODUCT_HAS_HISTORY') {
        return res.status(400).json({
          error: 'No se puede eliminar el producto porque tiene historial de comandas o ventas; desactívalo en lugar de eliminarlo.'
        });
      }
      return res.status(500).json({ error: 'Error al eliminar el producto', details: errorDetails(error) });
    }
  }
}

export const productController = new ProductController();
