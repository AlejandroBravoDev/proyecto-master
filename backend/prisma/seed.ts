import prisma from '../src/prisma/client';

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.inventoryMovement.deleteMany();
  await prisma.saleDetail.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.orderDetail.deleteMany();
  await prisma.order.deleteMany();
  await prisma.recipeDetail.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.product.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.category.deleteMany();

  // 1. Create Categories
  const catBebidas = await prisma.category.create({
    data: { name: 'Bebidas', description: 'Cafés, tés, jugos y gaseosas' }
  });
  const catHamburguesas = await prisma.category.create({
    data: { name: 'Hamburguesas', description: 'Hamburguesas artesanales de la casa' }
  });
  const catPostres = await prisma.category.create({
    data: { name: 'Postres', description: 'Postres caseros' }
  });

  // 2. Create Ingredients
  const ingPan = await prisma.ingredient.create({
    data: { name: 'Pan de Hamburguesa', measurementUnit: 'unidad', currentStock: 100, minimumStock: 20, unitCost: 0.5 }
  });
  const ingCarne = await prisma.ingredient.create({
    data: { name: 'Carne de Res 150g', measurementUnit: 'unidad', currentStock: 80, minimumStock: 15, unitCost: 1.5 }
  });
  const ingQueso = await prisma.ingredient.create({
    data: { name: 'Lámina de Queso Cheddar', measurementUnit: 'unidad', currentStock: 150, minimumStock: 30, unitCost: 0.3 }
  });
  const ingCafe = await prisma.ingredient.create({
    data: { name: 'Grano de Café Express', measurementUnit: 'g', currentStock: 5000, minimumStock: 1000, unitCost: 0.02 }
  });
  const ingLeche = await prisma.ingredient.create({
    data: { name: 'Leche Entera', measurementUnit: 'ml', currentStock: 10000, minimumStock: 2000, unitCost: 0.001 }
  });

  // 3. Create Products & Recipes
  // Product 1: Cheeseburger
  const prodBurger = await prisma.product.create({
    data: {
      categoryId: catHamburguesas.id,
      name: 'Hamburguesa con Queso',
      description: 'Hamburguesa con carne 150g, pan suave y doble queso cheddar',
      salePrice: 7.50,
      productType: 'PREPARED',
      recipe: {
        create: {
          name: 'Receta Cheeseburger',
          recipeDetails: {
            create: [
              { ingredientId: ingPan.id, quantity: 1, measurementUnit: 'unidad' },
              { ingredientId: ingCarne.id, quantity: 1, measurementUnit: 'unidad' },
              { ingredientId: ingQueso.id, quantity: 2, measurementUnit: 'unidad' }
            ]
          }
        }
      }
    }
  });

  // Product 2: Cappuccino
  const prodCappuccino = await prisma.product.create({
    data: {
      categoryId: catBebidas.id,
      name: 'Café Cappuccino',
      description: 'Espresso con leche al vapor y espumada',
      salePrice: 3.50,
      productType: 'PREPARED',
      recipe: {
        create: {
          name: 'Receta Cappuccino',
          recipeDetails: {
            create: [
              { ingredientId: ingCafe.id, quantity: 18, measurementUnit: 'g' },
              { ingredientId: ingLeche.id, quantity: 150, measurementUnit: 'ml' }
            ]
          }
        }
      }
    }
  });

  // Product 3: Direct Inventory Product
  const prodSoda = await prisma.product.create({
    data: {
      categoryId: catBebidas.id,
      name: 'Gaseosa 350ml',
      description: 'Lata de gaseosa fría',
      salePrice: 2.00,
      productType: 'DIRECT_INVENTORY'
    }
  });

  console.log('✅ Database seeded successfully!');
  console.log({
    categories: 3,
    ingredients: 5,
    products: [prodBurger.name, prodCappuccino.name, prodSoda.name]
  });
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
