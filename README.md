Fullstack-разработчик | DevOps | React + Node.js + Docker

Разработал и запустил в продакшен CRM-систему для тюнинг-ателье с нуля один человек.

Стек: TypeScript, React, Node.js, Prisma, PostgreSQL, Docker, Nginx, Prometheus, Grafana.

Что сделал:
- Спроектировал БД (10+ моделей, миграции)
- Написал backend (8 API-роутов, JWT в HttpOnly cookie, аудит)
- Написал frontend (12 страниц, корзина, печать чеков, аналитика)
- Настроил VPS (Ubuntu, Nginx, SSL, Docker Compose)
- Настроил CI/CD (GitHub Actions, автодеплой)
- Настроил мониторинг (Prometheus + Grafana + Telegram-алерты)
- Настроил автоматические бэкапы (cron, ежедневно, ротация 30 дней)
- Написал скрипты восстановления и диагностики (crm-doctor, crm-restore)

Результат: система работает 24/7, менеджеры оформляют заказы, бэкапы создаются автоматически.

SalesCore CRM - Система управления продажами

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-compose-blue.svg)](https://www.docker.com)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org)

 О проекте

SalesCore CRM - это современная система управления взаимоотношениями с клиентами (CRM), разработанная для малого и среднего бизнеса. Система предоставляет полный набор инструментов для управления продажами, клиентской базой и аналитикой.

 Основные возможности

- Управление клиентами - полная история взаимодействия
- Воронка продаж - отслеживание сделок на всех этапах
- Аналитика и отчеты - дашборды с ключевыми метриками
- Управление задачами - назначение и контроль выполнения
- Интеграция с email - автоматическая рассылка
- Мониторинг - Prometheus + Grafana
- Резервное копирование - автоматическое и ручное

Технологический стек

Backend
- Node.js 20 - среда выполнения
- Express.js - веб-фреймворк
- Prisma ORM - работа с базой данных
- PostgreSQL 15 - основная БД
- JWT - аутентификация
- Helmet.js - безопасность

Frontend
- React 18 - библиотека UI
- Vite - сборщик
- Axios - HTTP клиент
- React Router - маршрутизация

DevOps & Мониторинг
- Docker & Docker Compose - контейнеризация
- Nginx - веб-сервер и прокси
- Prometheus - сбор метрик
- Grafana - визуализация
- Node Exporter - метрики хоста

Требования к системе

- Docker >= 20.10.0
- Docker Compose >= 1.29.0
- Node.js >= 20.x (для разработки)
- PostgreSQL >= 15 (для разработки)
- RAM: минимум 2GB
- CPU: 2 ядра
- Диск: 20GB свободного места

Быстрый старт

Клонирование репозитория

bash
git clone https://github.com/yourusername/salescore-crm.git
cd salescore-crm


Настройка окружения

bash
# Копируем пример конфигурации
cp .env.example .env

# Редактируем .env файл
nano .env


Пример `.env` файла:
env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=crm_db
DATABASE_URL=postgresql://postgres:your_secure_password@postgres:5432/crm_db?schema=public

# JWT
JWT_SECRET=your_jwt_secret_key_here

# Monitoring
GRAFANA_PASSWORD=your_grafana_password

# Email (опционально)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password


Запуск с Docker Compose

bash
# Сборка и запуск всех сервисов
docker-compose up -d --build

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f


Инициализация базы данных
bash
# Запуск миграций
docker exec crm-backend npx prisma migrate deploy

# Создание администратора
docker exec crm-backend npm run seed

Структура проекта
salescore-crm/
├── backend/                 # Backend приложение
│   ├── src/
│   │   ├── controllers/    # Контроллеры
│   │   ├── middleware/     # Middleware
│   │   ├── routes/         # Маршруты
│   │   ├── utils/          # Утилиты
│   │   └── server.js       # Точка входа
│   ├── prisma/             # Prisma схемы
│   ├── package.json
│   └── Dockerfile
├── frontend/               # Frontend приложение
│   ├── src/
│   │   ├── components/     # React компоненты
│   │   ├── pages/          # Страницы
│   │   ├── services/       # API сервисы
│   │   └── App.jsx
│   ├── package.json
│   └── Dockerfile
├── prometheus/             # Конфигурация Prometheus
│   └── prometheus.yml
├── nginx/                  # Конфигурация Nginx
│   └── swapcrm38.conf
├── scripts/                # Вспомогательные скрипты
│   ├── crm-backup.sh      # Резервное копирование
│   ├── crm-restore.sh     # Восстановление
│   └── crm-doctor.sh      # Диагностика
├── docker-compose.yml
├── .env.example
└── README.md


Управление проектом

### Основные команды

bash
# Запуск всех сервисов
docker-compose up -d

# Остановка всех сервисов
docker-compose down

# Перезапуск конкретного сервиса
docker-compose restart backend

# Просмотр логов
docker-compose logs -f backend
docker-compose logs -f frontend

# Вход в контейнер
docker exec -it crm-backend sh
docker exec -it crm-db psql -U postgres -d crm_db

Резервное копирование

bash
# Ручное создание бэкапа
sudo crm-backup

# Просмотр бэкапов
ls -lh /var/backups/crm_db/ 

# Восстановление из бэкапа
sudo crm-restore crm_backup_YYYYMMDD_HHMMSS.sql.gz
Диагностика

bash
# Запуск полной диагностики
sudo crm-doctor

# Проверка статуса контейнеров
docker-compose ps

# Проверка здоровья БД
docker exec crm-db pg_isready -U postgres

 Разработка

Локальная разработка (без Docker)

Backend
bash
cd backend
npm install
cp .env.example .env
# Настройте DATABASE_URL для локальной БД
npm run dev


Frontend
bash
cd frontend
npm install
cp .env.example .env
# Настройте VITE_API_URL
npm run dev


Добавление новых зависимостей

bash
# Backend
docker exec crm-backend npm install package-name

# Frontend
docker exec crm-frontend npm install package-name

# Пересборка контейнера
docker-compose build backend
docker-compose up -d backend

Безопасность

Реализованные меры

- HTTPS - шифрование трафика (Let's Encrypt)
- Helmet.js - защита HTTP заголовков
- CORS - ограничение доступа к API
- JWT - токен-базированная аутентификация
- HttpOnly Cookies - защита от XSS
- Rate Limiting - защита от DDoS
- SQL Injection - защита через Prisma ORM

Мониторинг

Prometheus метрики
- Запросы в секунду (RPS)
- Время ответа API
- Использование памяти/CPU
- Активные соединения с БД

Grafana дашборды
- Общая статистика системы
- Аналитика продаж
- Ошибки и логи
- Производительность


Масштабирование

Горизонтальное масштабирование

yaml
# docker-compose.prod.yml
backend:
  deploy:
    replicas: 3
    resources:
      limits:
        cpus: '1'
        memory: 1G
Оптимизация производительности

- Кэширование - Redis для сессий и запросов
- CDN - для статических файлов
- Балансировщик - Nginx как load balancer
- Read replicas - для PostgreSQL

