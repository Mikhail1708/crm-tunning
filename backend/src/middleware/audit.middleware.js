// backend/src/middleware/audit.middleware.js
const auditService = require('../services/audit.service');

// Middleware для логирования всех запросов
const auditLog = (req, res, next) => {
  // Сохраняем оригинальный метод send
  const originalSend = res.send;
  
  // Получаем пользователя из запроса (если есть)
  const user = req.user || null;
  
  // Формируем детали запроса
  const details = {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    body: req.method === 'GET' ? undefined : req.body,
    params: req.params,
    statusCode: null
  };
  
  // Перехватываем ответ
  res.send = function(data) {
    details.statusCode = res.statusCode;
    
    // Логируем только важные действия
    const shouldLog = shouldLogAction(req.method, req.originalUrl);
    
    if (shouldLog) {
      const action = getActionName(req.method, req.originalUrl);
      const logDetails = { ...details };
      
      // Убираем чувствительные данные
      if (logDetails.body && logDetails.body.password) {
        delete logDetails.body.password;
      }
      
      auditService.log(user, action, {
        ...logDetails,
        responseStatus: res.statusCode
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Определяем, нужно ли логировать действие
function shouldLogAction(method, url) {
  // Игнорируем статические файлы и health check
  if (url.includes('/health') || url.includes('/static')) {
    return false;
  }
  
  // Игнорируем GET запросы к спискам (кроме важных)
  if (method === 'GET' && (
    url.includes('/products') && !url.includes('/low-stock')
  )) {
    return false;
  }
  
  return true;
}

// Получаем название действия
function getActionName(method, url) {
  const actionMap = {
    'POST /api/auth/login': 'Вход в систему',
    'POST /api/auth/register': 'Регистрация пользователя',
    'GET /api/auth/logout': 'Выход из системы',
    'POST /api/products': 'Создание товара',
    'PUT /api/products/': 'Редактирование товара',
    'DELETE /api/products/': 'Удаление товара',
    'POST /api/categories': 'Создание категории',
    'PUT /api/categories/': 'Редактирование категории',
    'DELETE /api/categories/': 'Удаление категории',
    'POST /api/categories/.*/fields': 'Добавление характеристики',
    'PUT /api/categories/fields/': 'Редактирование характеристики',
    'DELETE /api/categories/fields/': 'Удаление характеристики',
    'POST /api/clients': 'Создание клиента',
    'PUT /api/clients/': 'Редактирование клиента',
    'DELETE /api/clients/': 'Удаление клиента',
    'POST /api/sale-documents': 'Создание заказа',
    'PUT /api/sale-documents/.*/payment': 'Оплата заказа',
    'DELETE /api/sale-documents/': 'Удаление заказа',
    'DELETE /api/reports/clear': 'Очистка истории',
    'POST /api/reports/backup': 'Создание резервной копии',
    'POST /api/reports/restore': 'Восстановление из резервной копии'
  };
  
  // Ищем совпадение
  for (const [pattern, name] of Object.entries(actionMap)) {
    const regex = new RegExp(pattern.replace(/\//g, '\\/'));
    if (regex.test(`${method} ${url}`)) {
      return name;
    }
  }
  
  return `${method} ${url}`;
}

module.exports = { auditLog };