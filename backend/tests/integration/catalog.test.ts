import { idByName, useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

describe('/api/categories', () => {
  let id: number;

  it('GET / trae las categorías sembradas con _count.products, ordenadas por nombre', async () => {
    const res = await ctx.api.get('/api/categories');
    expect(res.status).toBe(200);
    const names = res.body.map((c: any) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(res.body[0]._count).toHaveProperty('products');
  });

  it('POST / crea, rechaza nombre vacío y duplicado', async () => {
    const created = await ctx.api.post('/api/categories').send({ name: 'Entradas', description: 'Para empezar' });
    expect(created.status).toBe(201);
    id = created.body.id;

    expect((await ctx.api.post('/api/categories').send({ name: '' })).status).toBe(400);
    expect((await ctx.api.post('/api/categories').send({})).status).toBe(400);
    expect((await ctx.api.post('/api/categories').send({ name: 'Entradas' })).status).toBe(400);
  });

  // T1: un nombre de solo espacios se aceptaba (201) porque se validaba `!name` sin trim().
  it('POST / rechaza un nombre con solo espacios o que no es texto (T1)', async () => {
    const spaces = await ctx.api.post('/api/categories').send({ name: '   ' });
    expect(spaces.status).toBe(400);
    expect(spaces.body.error).toMatch(/nombre/i);
    expect((await ctx.api.post('/api/categories').send({ name: 42 })).status).toBe(400);
    const all = (await ctx.api.get('/api/categories')).body as any[];
    expect(all.some((c) => c.name.trim() === '')).toBe(false);
  });

  it('POST / recorta el nombre, trata el texto vacío de la descripción como null y rechaza una descripción que no es texto', async () => {
    const res = await ctx.api.post('/api/categories').send({ name: '  Con espacios  ', description: '   ' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Con espacios');
    expect(res.body.description).toBeNull();

    // el duplicado se detecta con el nombre ya recortado
    expect((await ctx.api.post('/api/categories').send({ name: 'Con espacios ' })).status).toBe(400);
    expect((await ctx.api.post('/api/categories').send({ name: 'Otra', description: 7 })).status).toBe(400);
    await ctx.api.delete(`/api/categories/${res.body.id}`);
  });

  it('PUT /:id edita y 404 si no existe', async () => {
    const res = await ctx.api.put(`/api/categories/${id}`).send({ description: 'Nuevo texto' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Nuevo texto');
    expect((await ctx.api.put('/api/categories/999999').send({ name: 'x' })).status).toBe(404);
  });

  it('PUT /:id con description null (o vacía) limpia el campo; omitirla no la toca (B10)', async () => {
    const keep = await ctx.api.put(`/api/categories/${id}`).send({ name: 'Entradas' });
    expect(keep.body.description).toBe('Nuevo texto');

    const cleared = await ctx.api.put(`/api/categories/${id}`).send({ description: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.description).toBeNull();

    await ctx.api.put(`/api/categories/${id}`).send({ description: 'De nuevo' });
    const empty = await ctx.api.put(`/api/categories/${id}`).send({ description: '' });
    expect(empty.body.description).toBeNull();
  });

  it('PUT /:id valida el nombre (vacío o solo espacios -> 400) y el duplicado (400)', async () => {
    expect((await ctx.api.put(`/api/categories/${id}`).send({ name: '   ' })).status).toBe(400);
    expect((await ctx.api.put(`/api/categories/${id}`).send({ name: '' })).status).toBe(400);
    const dup = await ctx.api.put(`/api/categories/${id}`).send({ name: 'Bebidas' });
    expect(dup.status).toBe(400);
    expect(dup.body.error).toMatch(/ya existe/i);
    // sigue con su nombre
    expect((await ctx.api.get(`/api/categories/${id}`)).body.name).toBe('Entradas');
  });

  it('DELETE /:id elimina una categoría vacía', async () => {
    const res = await ctx.api.delete(`/api/categories/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect((await ctx.api.get(`/api/categories/${id}`)).status).toBe(404);
    expect((await ctx.api.delete(`/api/categories/${id}`)).status).toBe(404);
  });

  // B5: borrar una categoría con productos respondía 500 (FK restrict).
  it('DELETE de una categoría con productos responde 400 con la cuenta de productos y no la borra (B5)', async () => {
    const cats = (await ctx.api.get('/api/categories')).body as any[];
    const hamburguesas = cats.find((c) => c.name === 'Hamburguesas');
    const count = hamburguesas._count.products;
    expect(count).toBeGreaterThan(0);

    const res = await ctx.api.delete(`/api/categories/${hamburguesas.id}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(new RegExp(`${count} producto`));
    expect(res.body.error).toMatch(/mueve o elimina/i);
    expect(res.body.details).toBeUndefined();

    expect((await ctx.api.get(`/api/categories/${hamburguesas.id}`)).status).toBe(200);
    const products = (await ctx.api.get('/api/products')).body as any[];
    expect(products.some((p) => p.name === 'Hamburguesa con Queso')).toBe(true);
  });

  it('una categoría se puede borrar cuando se le mueven o eliminan sus productos (B5)', async () => {
    const temp = await ctx.api.post('/api/categories').send({ name: 'Temporal' });
    const cats = (await ctx.api.get('/api/categories')).body as any[];
    const product = await ctx.api.post('/api/products').send({ categoryId: temp.body.id, name: 'Item temporal', salePrice: 1 });
    expect(product.status).toBe(201);

    const blocked = await ctx.api.delete(`/api/categories/${temp.body.id}`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/1 producto asociado/);

    // mover el producto a otra categoría libera la categoría
    const moved = await ctx.api.put(`/api/products/${product.body.id}`).send({ categoryId: idByName(cats, 'Postres') });
    expect(moved.status).toBe(200);
    expect(moved.body.category.name).toBe('Postres');
    expect((await ctx.api.delete(`/api/categories/${temp.body.id}`)).status).toBe(200);
    await ctx.api.delete(`/api/products/${product.body.id}`);
  });
});

describe('/api/products', () => {
  let categoryId: number;
  let productId: number;

  beforeAll(async () => {
    const cats = (await ctx.api.get('/api/categories')).body;
    categoryId = idByName(cats, 'Postres');
  });

  it('GET / incluye categoría y receta de la hamburguesa sembrada', async () => {
    const res = await ctx.api.get('/api/products');
    expect(res.status).toBe(200);
    const burger = res.body.find((p: any) => p.name === 'Hamburguesa con Queso');
    expect(burger.category.name).toBe('Hamburguesas');
    expect(burger.recipe.recipeDetails).toHaveLength(3);
  });

  it('GET / filtra por categoryId, available y productType', async () => {
    const cats = (await ctx.api.get('/api/categories')).body;
    const byCat = await ctx.api.get(`/api/products?categoryId=${idByName(cats, 'Bebidas')}`);
    expect(byCat.body.every((p: any) => p.category.name === 'Bebidas')).toBe(true);

    const direct = await ctx.api.get('/api/products?productType=DIRECT_INVENTORY');
    expect(direct.body.length).toBeGreaterThan(0);
    expect(direct.body.every((p: any) => p.productType === 'DIRECT_INVENTORY')).toBe(true);
  });

  it('POST / crea un producto y valida campos obligatorios', async () => {
    const res = await ctx.api
      .post('/api/products')
      .send({ categoryId, name: 'Flan', salePrice: 4.25, description: 'Casero' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Flan', available: true });
    productId = res.body.id;

    expect((await ctx.api.post('/api/products').send({ name: 'Sin precio', categoryId })).status).toBe(400);
    expect((await ctx.api.post('/api/products').send({ salePrice: 1, name: 'Sin categoria' })).status).toBe(400);
  });

  it('POST / rechaza nombre vacío o solo espacios, datos mal formados y una categoría inexistente', async () => {
    const bad: Array<[string, Record<string, unknown>, RegExp?]> = [
      ['nombre de solo espacios', { categoryId, name: '   ', salePrice: 1 }],
      ['nombre que no es texto', { categoryId, name: 5, salePrice: 1 }],
      ['categoryId no numérico', { categoryId: 'abc', name: 'X1', salePrice: 1 }],
      ['categoría inexistente', { categoryId: 999999, name: 'Fantasma', salePrice: 1 }, /categoría/i],
      ['precio negativo', { categoryId, name: 'X2', salePrice: -1 }, /precio/i],
      ['precio no numérico', { categoryId, name: 'X3', salePrice: 'caro' }],
      ['available que no es booleano', { categoryId, name: 'X4', salePrice: 1, available: 'si' }],
      ['productType fuera del enum', { categoryId, name: 'X5', salePrice: 1, productType: 'OTRO' }],
      ['descripción que no es texto', { categoryId, name: 'X6', salePrice: 1, description: 3 }],
    ];
    for (const [label, body, message] of bad) {
      const res = await ctx.api.post('/api/products').send(body);
      expect([label, res.status]).toEqual([label, 400]);
      if (message) expect(res.body.error).toMatch(message);
    }

    const list = (await ctx.api.get('/api/products')).body as any[];
    expect(list.some((p) => ['Fantasma', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6'].includes(p.name))).toBe(false);
    expect(list.some((p) => p.name.trim() === '')).toBe(false);
  });

  it('POST / recorta el nombre y guarda descripción/imagen vacías como null', async () => {
    const res = await ctx.api
      .post('/api/products')
      .send({ categoryId, name: '  Natilla  ', salePrice: '2.5', description: '  ', image: '' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Natilla', description: null, image: null });
    expect(Number(res.body.salePrice)).toBe(2.5);
    await ctx.api.delete(`/api/products/${res.body.id}`);
  });

  it('POST / con receta anidada la crea; una unidad omitida usa la del insumo', async () => {
    const ingredients = (await ctx.api.get('/api/ingredients')).body as any[];
    const pan = ingredients.find((i) => i.name === 'Pan de Hamburguesa');

    const res = await ctx.api.post('/api/products').send({
      categoryId,
      name: 'Tostada',
      salePrice: 3,
      recipe: { ingredients: [{ ingredientId: pan.id, quantity: 2 }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.recipe.name).toBe('Receta de Tostada');
    expect(res.body.recipe.recipeDetails).toHaveLength(1);
    expect(res.body.recipe.recipeDetails[0]).toMatchObject({ ingredientId: pan.id, quantity: 2, measurementUnit: pan.measurementUnit });
    await ctx.api.delete(`/api/products/${res.body.id}`);
  });

  it('POST / con receta inválida (insumo inexistente, repetido, cantidad 0) responde 400 y no crea el producto', async () => {
    const ingredients = (await ctx.api.get('/api/ingredients')).body as any[];
    const pan = ingredients.find((i) => i.name === 'Pan de Hamburguesa').id;

    const cases: Array<[string, unknown]> = [
      ['insumo inexistente', { ingredients: [{ ingredientId: 999999, quantity: 1 }] }],
      ['insumo repetido', { ingredients: [{ ingredientId: pan, quantity: 1 }, { ingredientId: pan, quantity: 2 }] }],
      ['cantidad cero', { ingredients: [{ ingredientId: pan, quantity: 0 }] }],
      ['ingredients no es arreglo', { ingredients: 'pan' }],
      ['recipe no es objeto', 'receta'],
    ];
    for (const [label, recipe] of cases) {
      const res = await ctx.api.post('/api/products').send({ categoryId, name: 'Receta rota', salePrice: 1, recipe });
      expect([label, res.status]).toEqual([label, 400]);
      expect(typeof res.body.error).toBe('string');
    }
    const list = (await ctx.api.get('/api/products')).body as any[];
    expect(list.some((p) => p.name === 'Receta rota')).toBe(false);
  });

  it('PUT /:id cambia el precio y la disponibilidad', async () => {
    const res = await ctx.api.put(`/api/products/${productId}`).send({ salePrice: 5, available: false });
    expect(res.status).toBe(200);
    expect(Number(res.body.salePrice)).toBe(5);
    expect(res.body.available).toBe(false);
  });

  // B10 (contrato con el frontend): description e image se pueden limpiar con null o texto vacío
  it('PUT /:id con description null (o vacía) la limpia; omitirla no la toca (B10)', async () => {
    const before = (await ctx.api.get(`/api/products/${productId}`)).body;
    expect(before.description).toBe('Casero');

    const untouched = await ctx.api.put(`/api/products/${productId}`).send({ salePrice: 5 });
    expect(untouched.body.description).toBe('Casero');

    const cleared = await ctx.api.put(`/api/products/${productId}`).send({ description: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.description).toBeNull();

    await ctx.api.put(`/api/products/${productId}`).send({ description: 'Otra vez' });
    const empty = await ctx.api.put(`/api/products/${productId}`).send({ description: '' });
    expect(empty.body.description).toBeNull();

    await ctx.api.put(`/api/products/${productId}`).send({ image: 'flan.png' });
    const noImage = await ctx.api.put(`/api/products/${productId}`).send({ image: null });
    expect(noImage.body.image).toBeNull();
  });

  it('PUT /:id valida cada campo enviado y la categoría destino', async () => {
    const bad: Array<[string, Record<string, unknown>]> = [
      ['nombre vacío', { name: '   ' }],
      ['precio negativo', { salePrice: -3 }],
      ['precio no numérico', { salePrice: 'x' }],
      ['available no booleano', { available: 'yes' }],
      ['productType inválido', { productType: 'ZZZ' }],
      ['categoryId inválido', { categoryId: 'abc' }],
      ['categoría inexistente', { categoryId: 999999 }],
      ['descripción no texto', { description: 12 }],
    ];
    for (const [label, body] of bad) {
      const res = await ctx.api.put(`/api/products/${productId}`).send(body);
      expect([label, res.status]).toEqual([label, 400]);
    }
    // nada de lo anterior modificó el producto
    const now = (await ctx.api.get(`/api/products/${productId}`)).body;
    expect(now).toMatchObject({ name: 'Flan', available: false, categoryId });
    expect((await ctx.api.put('/api/products/999999').send({ name: 'x' })).status).toBe(404);
  });

  it('DELETE /:id lo elimina y luego da 404', async () => {
    expect((await ctx.api.delete(`/api/products/${productId}`)).status).toBe(200);
    expect((await ctx.api.get(`/api/products/${productId}`)).status).toBe(404);
    expect((await ctx.api.delete(`/api/products/${productId}`)).status).toBe(404);
  });
});

describe('/api/recipes', () => {
  let productId: number;
  let panId: number;
  let carneId: number;
  let quesoId: number;
  let panUnit: string;

  beforeAll(async () => {
    const cats = (await ctx.api.get('/api/categories')).body;
    const created = await ctx.api
      .post('/api/products')
      .send({ categoryId: idByName(cats, 'Postres'), name: 'Batido de prueba', salePrice: 6 });
    productId = created.body.id;

    const ingredients = (await ctx.api.get('/api/ingredients')).body as any[];
    panId = idByName(ingredients, 'Pan de Hamburguesa');
    carneId = idByName(ingredients, 'Carne de Res 150g');
    quesoId = idByName(ingredients, 'Lámina de Queso Cheddar');
    panUnit = ingredients.find((i) => i.id === panId).measurementUnit;
  });

  it('GET /product/:id devuelve la receta de la hamburguesa y 404 si no tiene', async () => {
    const products = (await ctx.api.get('/api/products')).body;
    const burgerId = idByName(products, 'Hamburguesa con Queso');
    const ok = await ctx.api.get(`/api/recipes/product/${burgerId}`);
    expect(ok.status).toBe(200);
    expect(ok.body.recipeDetails).toHaveLength(3);

    const cappuccinoId = idByName(products, 'Café Cappuccino');
    expect((await ctx.api.get(`/api/recipes/product/${cappuccinoId}`)).status).toBe(404);
  });

  it('POST / crea la receta de un producto y luego la reemplaza', async () => {
    const products = (await ctx.api.get('/api/products')).body;
    const cappuccinoId = idByName(products, 'Café Cappuccino');

    const first = await ctx.api.post('/api/recipes').send({
      productId: cappuccinoId,
      ingredients: [{ ingredientId: panId, quantity: 1, measurementUnit: 'unidad' }],
    });
    expect(first.status).toBe(201);

    const second = await ctx.api.post('/api/recipes').send({
      productId: cappuccinoId,
      ingredients: [{ ingredientId: carneId, quantity: 2, measurementUnit: 'unidad' }],
    });
    expect(second.status).toBe(201);

    const read = await ctx.api.get(`/api/recipes/product/${cappuccinoId}`);
    expect(read.body.recipeDetails).toHaveLength(1);
    expect(read.body.recipeDetails[0].ingredientId).toBe(carneId);
  });

  it('POST / responde 404 con un producto inexistente', async () => {
    const res = await ctx.api.post('/api/recipes').send({ productId: 999999, ingredients: [] });
    expect([400, 404]).toContain(res.status);
  });

  it('POST / reemplaza la receta de un producto ya creado (contrato de ProductModal al editar)', async () => {
    const first = await ctx.api.post('/api/recipes').send({
      productId,
      name: 'Receta del batido',
      ingredients: [
        { ingredientId: panId, quantity: 1 },
        { ingredientId: carneId, quantity: 2, measurementUnit: 'porción' },
      ],
    });
    expect(first.status).toBe(201);
    expect(first.body.name).toBe('Receta del batido');
    expect(first.body.recipeDetails).toHaveLength(2);
    // sin unidad usa la del insumo; con unidad respeta la enviada
    const byIngredient = new Map<number, any>(first.body.recipeDetails.map((d: any) => [d.ingredientId, d]));
    expect(byIngredient.get(panId).measurementUnit).toBe(panUnit);
    expect(byIngredient.get(carneId).measurementUnit).toBe('porción');

    // se reemplaza por completo (sin pan, con queso) y, sin nombre nuevo, conserva el nombre anterior
    const second = await ctx.api.post('/api/recipes').send({
      productId,
      ingredients: [{ ingredientId: quesoId, quantity: 3 }],
    });
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.name).toBe('Receta del batido');

    const product = (await ctx.api.get(`/api/products/${productId}`)).body;
    expect(product.recipe.recipeDetails.map((d: any) => [d.ingredientId, d.quantity])).toEqual([[quesoId, 3]]);
  });

  it('POST / con datos inválidos responde 400 y NO altera la receta anterior (reemplazo atómico)', async () => {
    const snapshot = async () => (await ctx.api.get(`/api/recipes/product/${productId}`)).body.recipeDetails
      .map((d: any) => [d.ingredientId, d.quantity])
      .sort();
    const before = await snapshot();
    expect(before).toEqual([[quesoId, 3]]);

    const bad: Array<[string, Record<string, unknown>]> = [
      ['sin productId', { ingredients: [{ ingredientId: panId, quantity: 1 }] }],
      ['productId no numérico', { productId: 'abc', ingredients: [] }],
      ['ingredients no es arreglo', { productId, ingredients: 'pan' }],
      ['ingredients ausente', { productId }],
      ['cantidad cero', { productId, ingredients: [{ ingredientId: panId, quantity: 0 }] }],
      ['insumo repetido', { productId, ingredients: [{ ingredientId: panId, quantity: 1 }, { ingredientId: panId, quantity: 1 }] }],
      ['insumo inexistente (el resto sí es válido)', { productId, ingredients: [{ ingredientId: panId, quantity: 1 }, { ingredientId: 999999, quantity: 1 }] }],
      ['nombre que no es texto', { productId, name: 5, ingredients: [{ ingredientId: panId, quantity: 1 }] }],
    ];
    for (const [label, body] of bad) {
      const res = await ctx.api.post('/api/recipes').send(body);
      expect([label, res.status]).toEqual([label, 400]);
      expect(typeof res.body.error).toBe('string');
    }

    expect(await snapshot()).toEqual(before);
  });

  it('POST / con una lista vacía deja la receta sin insumos (el producto no descontará stock)', async () => {
    const res = await ctx.api.post('/api/recipes').send({ productId, ingredients: [] });
    expect(res.status).toBe(201);
    expect(res.body.recipeDetails).toHaveLength(0);
  });

  it('DELETE /:id elimina la receta y 404 si no existe', async () => {
    const recipe = (await ctx.api.get(`/api/recipes/product/${productId}`)).body;
    expect((await ctx.api.delete(`/api/recipes/${recipe.id}`)).status).toBe(200);
    expect((await ctx.api.get(`/api/recipes/product/${productId}`)).status).toBe(404);
    expect((await ctx.api.delete(`/api/recipes/${recipe.id}`)).status).toBe(404);
  });
});
