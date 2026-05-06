import { useState } from 'react';

interface AdminLoginProps {
  onLogin: (username: string, pass: string) => void;
  error: string | null;
}

export default function AdminLogin({ onLogin, error }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-logo-icon">MP</div>
          <h1>Krator+ Admin</h1>
          <p>Acesso Restrito</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-field" style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="admin-input"
              placeholder="Usuário"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="admin-field" style={{ marginBottom: '1rem' }}>
            <input
              type="password"
              className="admin-input"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="admin-error" style={{ color: '#ff4d4d', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
          <button type="submit" className="admin-btn-primary" style={{ width: '100%' }}>Entrar</button>
        </form>
      </div>
    </div>
  );
}
