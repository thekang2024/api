// Importa tu pool de conexiones
import { pool } from '../db.js';

// Obtener todos los productos con sus especificaciones e inventario
export const getProducts = async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM Productos');
    for (let product of products) {
      // Obtener especificaciones
      const [specs] = await pool.query('SELECT NombreEspecificacion, ValorEspecificacion FROM Especificaciones WHERE ProductoID = ?', [product.ProductoID]);
      product.Especificaciones = specs;

      // Obtener inventario
      const [inventory] = await pool.query('SELECT CantidadComprada, CantidadVendida, CantidadDisponible, FechaUltimaActualizacion FROM Inventario WHERE ProductoID = ?', [product.ProductoID]);
      product.Inventario = inventory.length > 0 ? inventory[0] : null;
    }
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener un producto con sus especificaciones e inventario
export const getProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const [product] = await pool.query('SELECT * FROM Productos WHERE ProductoID = ?', [id]);
    if (product.length === 0) return res.status(404).json({ message: 'Producto no encontrado' });

    // Obtener especificaciones
    const [specs] = await pool.query('SELECT NombreEspecificacion, ValorEspecificacion FROM Especificaciones WHERE ProductoID = ?', [id]);
    product[0].Especificaciones = specs;

    // Obtener inventario
    const [inventory] = await pool.query('SELECT CantidadComprada, CantidadVendida, CantidadDisponible, FechaUltimaActualizacion FROM Inventario WHERE ProductoID = ?', [id]);
    product[0].Inventario = inventory.length > 0 ? inventory[0] : null;

    res.json(product[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener productos por categoría con especificaciones e inventario
export const getProductCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const [products] = await pool.query(`
      SELECT p.ProductoID, p.Nombre AS NombreProducto, p.Descripcion, p.Precio, 
             p.Imagen, c.Nombre AS NombreCategoria, pr.Nombre AS NombreProveedor
      FROM Productos p
      JOIN Categorias c ON p.CategoriaID = c.CategoriaID
      JOIN Proveedores pr ON p.ProveedorID = pr.ProveedorID
      WHERE p.CategoriaID = ?`, [id]);
      
    if (products.length === 0) return res.status(404).json({ message: 'No se encontraron productos para esta categoría' });

    for (let product of products) {
      // Obtener especificaciones
      const [specs] = await pool.query('SELECT NombreEspecificacion, ValorEspecificacion FROM Especificaciones WHERE ProductoID = ?', [product.ProductoID]);
      product.Especificaciones = specs;

      // Obtener inventario
      const [inventory] = await pool.query('SELECT CantidadComprada, CantidadVendida, CantidadDisponible, FechaUltimaActualizacion FROM Inventario WHERE ProductoID = ?', [product.ProductoID]);
      product.Inventario = inventory.length > 0 ? inventory[0] : null;
    }

    const categoryName = products[0].NombreCategoria;

    res.json({ categoryName, products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear un producto con especificaciones e inventario
export const createProducts = async (req, res) => {
  const { Nombre, Descripcion, Precio, CategoriaID, ProveedorID, Especificaciones, CantidadComprada } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO Productos (Nombre, Descripcion, Precio, CategoriaID, ProveedorID) VALUES (?, ?, ?, ?, ?)', 
      [Nombre, Descripcion, Precio, CategoriaID, ProveedorID]);

    const productoID = result.insertId;

    // Inserta las especificaciones del producto
    if (Especificaciones && Especificaciones.length > 0) {
      for (let spec of Especificaciones) {
        await pool.query('INSERT INTO Especificaciones (ProductoID, NombreEspecificacion, ValorEspecificacion) VALUES (?, ?, ?)', 
          [productoID, spec.NombreEspecificacion, spec.ValorEspecificacion]);
      }
    }

    // Inserta el inventario inicial
    await pool.query('INSERT INTO Inventario (ProductoID, CantidadComprada) VALUES (?, ?)', [productoID, CantidadComprada]);

    res.status(201).json({ id: productoID, Nombre, Descripcion, Precio, CategoriaID, ProveedorID, Especificaciones, CantidadComprada });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar un producto y su inventario
export const updateProducts = async (req, res) => {
  const { id } = req.params;
  const { Nombre, Descripcion, Precio, CategoriaID, ProveedorID, Especificaciones, CantidadComprada, CantidadVendida } = req.body;
  try {
    const [result] = await pool.query('UPDATE Productos SET Nombre = ?, Descripcion = ?, Precio = ?, CategoriaID = ?, ProveedorID = ? WHERE ProductoID = ?', 
      [Nombre, Descripcion, Precio, CategoriaID, ProveedorID, id]);

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Producto no encontrado' });

    // Actualizar las especificaciones
    if (Especificaciones && Especificaciones.length > 0) {
      await pool.query('DELETE FROM Especificaciones WHERE ProductoID = ?', [id]);
      for (let spec of Especificaciones) {
        await pool.query('INSERT INTO Especificaciones (ProductoID, NombreEspecificacion, ValorEspecificacion) VALUES (?, ?, ?)', 
          [id, spec.NombreEspecificacion, spec.ValorEspecificacion]);
      }
    }

    // Actualizar el inventario
    await pool.query('UPDATE Inventario SET CantidadComprada = ?, CantidadVendida = ? WHERE ProductoID = ?', [CantidadComprada, CantidadVendida, id]);

    res.json({ message: 'Producto y especificaciones actualizadas' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar un producto, sus especificaciones y su inventario
export const deleteProducts = async (req, res) => {
  const { id } = req.params;
  try {
    // Eliminar las especificaciones del producto
    await pool.query('DELETE FROM Especificaciones WHERE ProductoID = ?', [id]);

    // Eliminar el inventario del producto
    await pool.query('DELETE FROM Inventario WHERE ProductoID = ?', [id]);

    // Eliminar el producto
    const [result] = await pool.query('DELETE FROM Productos WHERE ProductoID = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Producto no encontrado' });

    res.json({ message: 'Producto, especificaciones e inventario eliminados' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
