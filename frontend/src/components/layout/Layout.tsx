// frontend/src/components/layout/Layout.tsx
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3,
  Tag,  
  LogOut,
  Menu,
  User,
  Users,
  Settings,
  History,
  Moon,
  Sun
} from 'lucide-react';

// Типы для навигации
type UserRole = 'admin' | 'manager';

interface NavItem {
  name: string;
  href: string;
  icon: React.FC<{ size?: number; className?: string }>;
  roles: UserRole[];
}

// Навигация с указанием доступных ролей
const navigation: NavItem[] = [
  { name: 'Главная', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
  { name: 'Товары', href: '/products', icon: Package, roles: ['admin', 'manager'] },
  { name: 'Категории', href: '/categories', icon: Tag, roles: ['admin', 'manager'] },
  { name: 'Клиенты', href: '/clients', icon: Users, roles: ['admin', 'manager'] },
  { name: 'Продажи', href: '/sales', icon: ShoppingCart, roles: ['admin', 'manager'] },
  { name: 'Аналитика', href: '/reports', icon: BarChart3, roles: ['admin', 'manager'] },
  { name: 'Журнал действий', href: '/audit', icon: History, roles: ['admin'] },
  { name: 'Настройки', href: '/settings', icon: Settings, roles: ['admin'] },
];

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string): boolean => {
    return location.pathname === path;
  };

  // Фильтруем навигацию по роли пользователя
  const userRole = (user?.role as UserRole) || 'manager';
  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(userRole)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Мобильная кнопка меню */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-md"
        aria-label="Открыть меню"
      >
        <Menu size={24} className="text-gray-900 dark:text-white" />
      </button>

      {/* Кнопка переключения темы (мобильная) */}
      <button
        onClick={toggleTheme}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-md"
        aria-label="Переключить тему"
      >
        {theme === 'dark' ? (
          <Sun size={24} className="text-yellow-500" />
        ) : (
          <Moon size={24} className="text-gray-700" />
        )}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900
        transform transition-transform duration-300 z-40
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-700">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">
              CRM SWAP38
            </h1>
            <p className="text-sm text-gray-400 mt-1">Управление продажами</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  navigate(item.href);
                  setSidebarOpen(false);
                }}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                  ${isActive(item.href) 
                    ? 'bg-primary-600 text-white shadow-lg' 
                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                  }
                `}
              >
                <item.icon size={20} />
                <span>{item.name}</span>
              </a>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50">
              <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{user?.name || 'Пользователь'}</p>
                <p className="text-sm text-gray-400">
                  {user?.role === 'admin' ? 'Администратор' : 'Менеджер'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Выйти"
                aria-label="Выйти"
              >
                <LogOut size={18} className="text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay для мобилки */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className="lg:ml-72 min-h-screen">
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};