/**
 * ====================================================
 * CONTROLADOR DE PRODUCTOS (CONTROLLER LAYER)
 * ====================================================
 * Atiende las peticiones HTTP relativas a productos y recetas asociadas.
 */

import { Request, Response } from 'express';
import { productService } from '../services/product.service';

export class ProductController {
  /**
   * GET /api/products
   * Retorna la lista de productos filtrada según parámetros de query.
   */
  async getProducts(req: Request, res: Response) {
    try {
      const { categoryId, available, productType } = req.query;

      const products = await productService.getProducts({
        categoryId: categoryId ? Number(categoryId) : undefined,
        available: available !== undefined ? available === 'true' : undefined,
        productType: productType ? String(productType) : undefined
      });

      return res.json(products);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener productos', details: error });
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
      return res.status(500).json({ error: 'Error al obtener el producto', details: error });
    }
  }

  /**
   * POST /api/products
   * Valida la entrada y registra un nuevo producto en el sistema.
   */
  async createProduct(req: Request, res: Response) {
    try {
      const { categoryId, name, description, salePrice, image, available, productType, recipe } = req.body;

      if (!categoryId || !name || salePrice === undefined) {
        return res.status(400).json({ error: 'categoryId, name y salePrice son obligatorios' });
      }

      const product = await productService.createProduct({
        categoryId: Number(categoryId),
        name,
        description,
        salePrice: Number(salePrice),
        image,
        available,
        productType,
        recipe
      });

      return res.status(201).json(product);
    } catch (error) {
      return res.status(500).json({ error: 'Error al crear el producto', details: error });
    }
  }

  /**
   * PUT /api/products/:id
   * Modifica las propiedades de un producto.
   */
  async updateProduct(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { categoryId, name, description, salePrice, image, available, productType } = req.body;

      const updated = await productService.updateProduct(id, {
        ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(salePrice !== undefined && { salePrice: Number(salePrice) }),
        ...(image !== undefined && { image }),
        ...(available !== undefined && { available: Boolean(available) }),
        ...(productType !== undefined && { productType })
      });

      return res.json(updated);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      return res.status(500).json({ error: 'Error al actualizar el producto', details: error });
    }
  }

  /**
   * DELETE /api/products/:id
   * Elimina un producto.
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
      return res.status(500).json({ error: 'Error al eliminar el producto', details: error });
    }
  }
}

export const productController = new ProductController();
