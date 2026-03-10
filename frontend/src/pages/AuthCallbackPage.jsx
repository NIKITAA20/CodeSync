import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store';
import { authAPI } from '../services/api';

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    if (!token) return navigate('/login');

    setToken(token);

    authAPI.me()
      .then(({ data }) => {
        setUser(data);
        navigate('/');
      })
      .catch(() => navigate('/login'));
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center font-mono">
      <div className="text-[#00FF88] text-sm animate-pulse">⚡ Signing you in...</div>
    </div>
  );
}
