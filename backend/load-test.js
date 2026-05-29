import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Кастомные метрики
const errorRate = new Rate('error_rate');
const createOrderDuration = new Trend('create_order_duration');
const createProductDuration = new Trend('create_product_duration');
const updateProductDuration = new Trend('update_product_duration');
const deleteProductDuration = new Trend('delete_product_duration');
const createClientDuration = new Trend('create_client_duration');
const updateClientDuration = new Trend('update_client_duration');
const deleteClientDuration = new Trend('delete_client_duration');
const createCategoryDuration = new Trend('create_category_duration');
const totalOperations = new Counter('total_operations');
const totalSuccess = new Counter('total_success');

// Конфигурация
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api';

// Тестовые пользователи
const testUsers = [
  { email: 'admin@crm.ru', password: 'admin123', role: 'admin' },
  { email: 'gurin@crm.ru', password: '1605', role: 'manager' },
  { email: 'batvenko@crm.ru', password: '182204', role: 'manager' }
];

// Функция для извлечения CSRF токена из cookie
function extractCsrfToken(cookies) {
  if (!cookies) return null;
  if (typeof cookies === 'string') {
    const match = cookies.match(/csrf-token=([^;]+)/);
    return match ? match[1] : null;
  }
  if (cookies['csrf-token']) return cookies['csrf-token'][0];
  return null;
}

// Генерация случайных данных
function randomString(prefix, length = 6) {
  return `${prefix}_${Math.random().toString(36).substring(2, length + 2)}`;
}

function randomPrice() {
  return Math.floor(Math.random() * 50000) + 500;
}

function randomPhone() {
  return `+7 (999) ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 90 + 10)}-${Math.floor(Math.random() * 90 + 10)}`;
}

// Функция для создания заголовков с CSRF
function getHeaders(session, includeCsrf = true) {
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': session.cookie
  };
  if (includeCsrf && session.csrfToken) {
    headers['X-CSRF-Token'] = session.csrfToken;
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  return headers;
}

// setup
export function setup() {
  console.log('💀 ПОЛНЫЙ ХАРДКОРНЫЙ ТЕСТ ВСЕХ ОПЕРАЦИЙ (С CSRF) 💀');
  console.log(`📍 URL: ${BASE_URL}`);
  console.log(`👥 Тестовых пользователей: ${testUsers.length}`);
  
  const sessions = [];
  
  for (const user of testUsers) {
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (loginRes.status === 200) {
      const setCookieHeader = loginRes.headers['Set-Cookie'];
      const csrfToken = extractCsrfToken(setCookieHeader);
      
      sessions.push({
        user: user,
        cookie: setCookieHeader,
        csrfToken: csrfToken,
      });
      
      console.log(`✅ Готов: ${user.email} (${user.role}) | CSRF: ${csrfToken ? '✅' : '❌'}`);
    } else {
      console.error(`❌ Ошибка аутентификации: ${user.email}`);
    }
  }
  
  // Получаем существующие ID для операций
  let existingProducts = [];
  let existingClients = [];
  let existingCategories = [];
  
  if (sessions.length > 0) {
    const headers = getHeaders(sessions[0], false);
    
    // Получаем товары
    const productsRes = http.get(`${BASE_URL}/products`, { headers });
    if (productsRes.status === 200) {
      existingProducts = JSON.parse(productsRes.body).slice(0, 100);
    }
    
    // Получаем клиентов
    const clientsRes = http.get(`${BASE_URL}/clients?limit=100`, { headers });
    if (clientsRes.status === 200) {
      const clientsData = JSON.parse(clientsRes.body);
      existingClients = clientsData.clients || [];
    }
    
    // Получаем категории
    const categoriesRes = http.get(`${BASE_URL}/categories`, { headers });
    if (categoriesRes.status === 200) {
      existingCategories = JSON.parse(categoriesRes.body);
    }
  }
  
  console.log(`📦 Существующих товаров: ${existingProducts.length}`);
  console.log(`👤 Существующих клиентов: ${existingClients.length}`);
  console.log(`📁 Существующих категорий: ${existingCategories.length}`);
  console.log(`\n🚀 ЗАПУСК ПОЛНОГО ТЕСТА С CSRF ЗАЩИТОЙ!\n`);
  
  return { sessions, existingProducts, existingClients, existingCategories };
}

// ХАРДКОРНЫЙ ТЕСТ - 20 минут
export const options = {
  stages: [
    { duration: '1m', target: 500 },    // Разогрев до 500
    { duration: '15m', target: 2000 },  // Основная нагрузка 2000
    { duration: '3m', target: 3000 },   // Пик 3000
    { duration: '1m', target: 0 },      // Спад
  ],
  
  thresholds: {
    http_req_duration: ['p(95) < 3000', 'p(99) < 5000'],
    error_rate: ['rate < 0.10'],
    create_order_duration: ['p(95) < 2000'],
    create_product_duration: ['p(95) < 1500'],
    create_client_duration: ['p(95) < 1000'],
  },
};

// ОСНОВНАЯ ФУНКЦИЯ
export default function (data) {
  const session = data.sessions[Math.floor(Math.random() * data.sessions.length)];
  
  if (!session || !session.csrfToken) {
    errorRate.add(1);
    sleep(0.5);
    return;
  }
  
  // Случайная операция (равномерное распределение)
  const operation = Math.random();
  
  // 20% - работа с товарами
  if (operation < 0.2) {
    productOperations(session, data);
  }
  // 20% - работа с клиентами
  else if (operation < 0.4) {
    clientOperations(session, data);
  }
  // 25% - создание заказов (самое важное)
  else if (operation < 0.65) {
    createOrder(session, data);
  }
  // 15% - работа с категориями
  else if (operation < 0.8) {
    categoryOperations(session, data);
  }
  // 20% - отчеты и аналитика
  else {
    reportOperations(session, data);
  }
  
  // Минимальная задержка
  sleep(Math.random() * 0.5 + 0.1);
}

// ============ ОПЕРАЦИИ С ТОВАРАМИ ============
function productOperations(session, data) {
  const operation = Math.random();
  
  if (operation < 0.4) {
    createProduct(session, data);
  } else if (operation < 0.7) {
    updateProduct(session, data);
  } else if (operation < 0.9) {
    deleteProduct(session, data);
  } else {
    getProducts(session);
  }
}

function createProduct(session, data) {
  const start = Date.now();
  
  const productData = {
    name: randomString('ТестТовар', 8),
    article: randomString('ART', 10).toUpperCase(),
    cost_price: randomPrice(),
    retail_price: randomPrice() + 500,
    stock: Math.floor(Math.random() * 100) + 10,
    min_stock: Math.floor(Math.random() * 20) + 1,
    description: `Тестовый товар созданный в нагрузочном тесте ${new Date().toISOString()}`,
    categoryIds: data.existingCategories.length > 0 ? 
      [data.existingCategories[Math.floor(Math.random() * data.existingCategories.length)].id] : [],
    characteristics: {
      "brand": randomString("Brand", 5),
      "color": ["Красный", "Синий", "Черный", "Белый"][Math.floor(Math.random() * 4)],
      "size": ["S", "M", "L", "XL"][Math.floor(Math.random() * 4)]
    },
    costBreakdown: [
      { name: "Материалы", amount: randomPrice() / 2 },
      { name: "Работа", amount: randomPrice() / 3 }
    ]
  };
  
  const response = http.post(`${BASE_URL}/products`, JSON.stringify(productData), {
    headers: getHeaders(session, true)
  });
  
  const success = response.status === 201;
  check(response, { 'product_created_201': (r) => r.status === 201 });
  
  createProductDuration.add(Date.now() - start);
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

function updateProduct(session, data) {
  if (!data.existingProducts || data.existingProducts.length === 0) {
    createProduct(session, data);
    return;
  }
  
  const start = Date.now();
  const product = data.existingProducts[Math.floor(Math.random() * data.existingProducts.length)];
  
  const updateData = {
    name: randomString('Обновленный', 8),
    retail_price: randomPrice(),
    stock: Math.floor(Math.random() * 200) + 10
  };
  
  const response = http.put(`${BASE_URL}/products/${product.id}`, JSON.stringify(updateData), {
    headers: getHeaders(session, true)
  });
  
  const success = response.status === 200;
  check(response, { 'product_updated_200': (r) => r.status === 200 });
  
  updateProductDuration.add(Date.now() - start);
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

function deleteProduct(session, data) {
  const start = Date.now();
  
  const tempProduct = {
    name: randomString('TempDel', 6),
    article: randomString('DEL', 8),
    cost_price: 100,
    retail_price: 200,
    stock: 1,
    min_stock: 1
  };
  
  const createRes = http.post(`${BASE_URL}/products`, JSON.stringify(tempProduct), {
    headers: getHeaders(session, true)
  });
  
  if (createRes.status === 201) {
    const productId = JSON.parse(createRes.body).id;
    const deleteRes = http.del(`${BASE_URL}/products/${productId}`, null, {
      headers: getHeaders(session, true)
    });
    
    const success = deleteRes.status === 200;
    check(deleteRes, { 'product_deleted_200': (r) => r.status === 200 });
    if (success) totalSuccess.add(1);
    deleteProductDuration.add(Date.now() - start);
  }
  
  totalOperations.add(1);
}

function getProducts(session) {
  const response = http.get(`${BASE_URL}/products`, { headers: getHeaders(session, false) });
  const success = response.status === 200;
  check(response, { 'products_list_200': (r) => r.status === 200 });
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

// ============ ОПЕРАЦИИ С КЛИЕНТАМИ ============
function clientOperations(session, data) {
  const operation = Math.random();
  
  if (operation < 0.4) {
    createClient(session, data);
  } else if (operation < 0.7) {
    updateClient(session, data);
  } else if (operation < 0.9) {
    deleteClient(session, data);
  } else {
    getClients(session);
  }
}

function createClient(session, data) {
  const start = Date.now();
  
  const clientData = {
    firstName: randomString('Имя', 5),
    lastName: randomString('Фамилия', 7),
    middleName: randomString('Отчество', 6),
    phone: randomPhone(),
    email: `${randomString('test', 8)}@test.ru`,
    city: ["Москва", "СПб", "Новосибирск", "Екатеринбург", "Казань"][Math.floor(Math.random() * 5)],
    carModel: ["Toyota", "BMW", "Mercedes", "Audi", "KIA"][Math.floor(Math.random() * 5)],
    carYear: 2015 + Math.floor(Math.random() * 9),
    carNumber: `A${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)}AA`,
    discountPercent: Math.floor(Math.random() * 30),
    notes: `Клиент создан в нагрузочном тесте ${new Date().toISOString()}`
  };
  
  const response = http.post(`${BASE_URL}/clients`, JSON.stringify(clientData), {
    headers: getHeaders(session, true)
  });
  
  const success = response.status === 201;
  check(response, { 'client_created_201': (r) => r.status === 201 });
  
  createClientDuration.add(Date.now() - start);
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

function updateClient(session, data) {
  if (!data.existingClients || data.existingClients.length === 0) {
    createClient(session, data);
    return;
  }
  
  const start = Date.now();
  const client = data.existingClients[Math.floor(Math.random() * data.existingClients.length)];
  
  const updateData = {
    firstName: randomString('Обновл', 5),
    city: ["Москва", "СПб", "Сочи", "Калининград"][Math.floor(Math.random() * 4)],
    discountPercent: Math.floor(Math.random() * 50)
  };
  
  const response = http.put(`${BASE_URL}/clients/${client.id}`, JSON.stringify(updateData), {
    headers: getHeaders(session, true)
  });
  
  const success = response.status === 200;
  check(response, { 'client_updated_200': (r) => r.status === 200 });
  
  updateClientDuration.add(Date.now() - start);
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

function deleteClient(session, data) {
  const start = Date.now();
  
  const tempClient = {
    firstName: randomString('TempDel', 5),
    lastName: randomString('TempDelLast', 7),
    phone: randomPhone()
  };
  
  const createRes = http.post(`${BASE_URL}/clients`, JSON.stringify(tempClient), {
    headers: getHeaders(session, true)
  });
  
  if (createRes.status === 201) {
    const clientId = JSON.parse(createRes.body).id;
    const deleteRes = http.del(`${BASE_URL}/clients/${clientId}`, null, {
      headers: getHeaders(session, true)
    });
    
    const success = deleteRes.status === 200;
    check(deleteRes, { 'client_deleted_200': (r) => r.status === 200 });
    if (success) totalSuccess.add(1);
    deleteClientDuration.add(Date.now() - start);
  }
  
  totalOperations.add(1);
}

function getClients(session) {
  const response = http.get(`${BASE_URL}/clients?limit=50`, { headers: getHeaders(session, false) });
  const success = response.status === 200;
  check(response, { 'clients_list_200': (r) => r.status === 200 });
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

// ============ СОЗДАНИЕ ЗАКАЗОВ ============
function createOrder(session, data) {
  if (!data.existingProducts || data.existingProducts.length === 0) return;
  
  const start = Date.now();
  
  const numItems = Math.floor(Math.random() * 5) + 1;
  const items = [];
  const usedIds = new Set();
  
  for (let i = 0; i < numItems; i++) {
    let randomId;
    do {
      randomId = data.existingProducts[Math.floor(Math.random() * data.existingProducts.length)].id;
    } while (usedIds.has(randomId));
    usedIds.add(randomId);
    
    items.push({
      productId: randomId,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: randomPrice()
    });
  }
  
  const orderData = {
    documentType: 'order',
    customerName: randomString('Заказчик', 8),
    customerPhone: randomPhone(),
    customerEmail: `${randomString('order', 6)}@test.ru`,
    items: items,
    discount: Math.random() > 0.8 ? Math.floor(Math.random() * 20) : 0,
    paymentMethod: Math.random() > 0.5 ? 'cash' : 'card',
    paymentStatus: Math.random() > 0.7 ? 'paid' : 'unpaid',
    description: `Тестовый заказ в нагрузочном тесте ${new Date().toISOString()}`
  };
  
  const response = http.post(`${BASE_URL}/sale-documents`, JSON.stringify(orderData), {
    headers: getHeaders(session, true)
  });
  
  const success = response.status === 201;
  check(response, { 'order_created_201': (r) => r.status === 201 });
  
  createOrderDuration.add(Date.now() - start);
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

// ============ ОПЕРАЦИИ С КАТЕГОРИЯМИ ============
function categoryOperations(session, data) {
  const operation = Math.random();
  
  if (operation < 0.5) {
    createCategory(session, data);
  } else if (operation < 0.8) {
    updateCategory(session, data);
  } else {
    deleteCategory(session, data);
  }
}

function createCategory(session, data) {
  const start = Date.now();
  
  const categoryData = {
    name: randomString('Категория', 10),
    description: `Тестовая категория ${new Date().toISOString()}`,
    icon: 'folder',
    sortOrder: Math.floor(Math.random() * 100)
  };
  
  const response = http.post(`${BASE_URL}/categories`, JSON.stringify(categoryData), {
    headers: getHeaders(session, true)
  });
  
  const success = response.status === 201;
  check(response, { 'category_created_201': (r) => r.status === 201 });
  
  createCategoryDuration.add(Date.now() - start);
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

function updateCategory(session, data) {
  if (!data.existingCategories || data.existingCategories.length === 0) {
    createCategory(session, data);
    return;
  }
  
  const category = data.existingCategories[Math.floor(Math.random() * data.existingCategories.length)];
  
  const updateData = {
    name: randomString('ОбновКат', 8),
    description: `Обновленная категория ${new Date().toISOString()}`
  };
  
  const response = http.put(`${BASE_URL}/categories/${category.id}`, JSON.stringify(updateData), {
    headers: getHeaders(session, true)
  });
  
  const success = response.status === 200;
  check(response, { 'category_updated_200': (r) => r.status === 200 });
  
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

function deleteCategory(session, data) {
  const start = Date.now();
  
  const tempCategory = {
    name: randomString('TempDelCat', 8),
    description: 'Временная категория для удаления'
  };
  
  const createRes = http.post(`${BASE_URL}/categories`, JSON.stringify(tempCategory), {
    headers: getHeaders(session, true)
  });
  
  if (createRes.status === 201) {
    const categoryId = JSON.parse(createRes.body).id;
    const deleteRes = http.del(`${BASE_URL}/categories/${categoryId}`, null, {
      headers: getHeaders(session, true)
    });
    
    const success = deleteRes.status === 200;
    check(deleteRes, { 'category_deleted_200': (r) => r.status === 200 });
    if (success) totalSuccess.add(1);
  }
  
  totalOperations.add(1);
}

// ============ ОТЧЕТЫ И АНАЛИТИКА ============
function reportOperations(session, data) {
  const reportType = Math.floor(Math.random() * 5);
  let response;
  let success = false;
  
  switch(reportType) {
    case 0:
      response = http.get(`${BASE_URL}/reports/summary`, { headers: getHeaders(session, false) });
      success = response.status === 200;
      check(response, { 'summary_200': (r) => r.status === 200 });
      break;
    case 1:
      response = http.get(`${BASE_URL}/reports/profit-by-product`, { headers: getHeaders(session, false) });
      success = response.status === 200;
      check(response, { 'profit_200': (r) => r.status === 200 });
      break;
    case 2:
      response = http.get(`${BASE_URL}/reports/profit-chart?period=month`, { headers: getHeaders(session, false) });
      success = response.status === 200;
      check(response, { 'chart_200': (r) => r.status === 200 });
      break;
    case 3:
      response = http.get(`${BASE_URL}/reports/expenses`, { headers: getHeaders(session, false) });
      success = response.status === 200;
      check(response, { 'expenses_200': (r) => r.status === 200 });
      break;
    case 4:
      response = http.get(`${BASE_URL}/reports/stats/month`, { headers: getHeaders(session, false) });
      success = response.status === 200;
      check(response, { 'stats_200': (r) => r.status === 200 });
      break;
  }
  
  totalOperations.add(1);
  if (success) totalSuccess.add(1);
  if (!success) errorRate.add(1);
}

// teardown
export function teardown(data) {
  console.log('\n' + '='.repeat(70));
  console.log('💀 ПОЛНЫЙ ХАРДКОРНЫЙ ТЕСТ ЗАВЕРШЕН 💀');
  console.log('='.repeat(70));
  console.log(`\n📊 ИТОГОВАЯ СТАТИСТИКА:`);
  console.log(`   📦 Всего операций: ${totalOperations.values.count}`);
  console.log(`   ✅ Успешных операций: ${totalSuccess.values.count}`);
  console.log(`   ❌ Ошибок: ${totalOperations.values.count - totalSuccess.values.count}`);
  console.log(`   📈 Процент успеха: ${((totalSuccess.values.count / totalOperations.values.count) * 100).toFixed(2)}%`);
  console.log(`\n⏱️  Тест длился 20 минут`);
  console.log('='.repeat(70));
}