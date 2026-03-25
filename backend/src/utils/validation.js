const validateProduct = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Название товара должно содержать минимум 2 символа');
  }
  
  if (data.cost_price !== undefined && data.cost_price < 0) {
    errors.push('Себестоимость не может быть отрицательной');
  }
  
  if (data.retail_price !== undefined && data.retail_price < 0) {
    errors.push('Розничная цена не может быть отрицательной');
  }
  
  if (data.stock !== undefined && data.stock < 0) {
    errors.push('Остаток не может быть отрицательным');
  }
  
  return errors;
};

const validateSale = (data, product) => {
  const errors = [];
  
  if (!data.quantity || data.quantity < 1) {
    errors.push('Количество должно быть больше 0');
  }
  
  if (data.quantity > product.stock) {
    errors.push(`Недостаточно товара на складе. Доступно: ${product.stock} шт`);
  }
  
  if (!data.selling_price || data.selling_price < 0) {
    errors.push('Цена продажи должна быть указана и быть больше 0');
  }
   if (saleData.selling_price < product.cost_price) {
    errors.push(`Цена продажи (${saleData.selling_price}) ниже себестоимости (${product.cost_price})`);
  }
  
  return errors;
};

module.exports = { validateProduct, validateSale };