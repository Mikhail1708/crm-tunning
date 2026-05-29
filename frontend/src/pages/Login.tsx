// frontend/src/pages/Login.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardBody } from '../components/ui/Card';
import { Mail, Lock, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { login } = useAuth();
  const navigate = useNavigate();

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (isSubmitting) return; 
  
  setIsSubmitting(true);
  try {
    await login(email, password);
    navigate('/dashboard');
  } catch (error) {
    // ошибка уже обработана в AuthContext
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50">
      <Card className="w-full max-w-md mx-4 animate-fade-in">
        <CardBody className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center">
              <LogIn size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Добро пожаловать</h1>
            <p className="text-gray-500 mt-2">Войдите в CRM систему</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              placeholder="Ваш логин"
              required
            />
            <Input
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={Lock}
              placeholder="Ваш пароль"
              required
            />
            <Button type="submit" disabled={isSubmitting} fullWidth>
  {isSubmitting ? 'Вход...' : 'Войти'}
</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default Login;