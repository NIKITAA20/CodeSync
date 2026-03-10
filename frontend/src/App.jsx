import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';
import { authAPI } from './services/api';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

function RequireAuth({ children }) {
  const { user, token, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center font-mono">
        <div className="text-[#00FF88] text-sm animate-pulse">⚡ Loading...</div>
      </div>
    );
  }
  if (!user || !token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token, setUser, setLoading, logout } = useAuthStore();

  // Bootstrap: load user from stored token on mount
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    authAPI.me()
      .then(({ data }) => setUser(data))
      .catch(() => { logout(); setLoading(false); });
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0D1117',
            color: '#E2E8F0',
            border: '1px solid #1E2A3A',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12px',
          },
          success: { iconTheme: { primary: '#00FF88', secondary: '#0A0E1A' } },
          error: { iconTheme: { primary: '#FF6B6B', secondary: '#0A0E1A' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/error" element={<div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center text-[#FF6B6B] font-mono">GitHub login failed. <a href="/login" className="underline ml-2">Try again</a></div>} />
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/room/:slug" element={<RequireAuth><RoomPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
