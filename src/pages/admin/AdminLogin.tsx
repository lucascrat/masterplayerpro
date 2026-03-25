import { useState } from 'react';

interface AdminLoginProps {
  onLogin: (pass: string) => void;
  error: string | null;
}

export default function AdminLogin({ onLogin, error }: AdminLoginProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-logo-icon">MP</div>
          <h1>MasterPlayer Admin</h1>
          <p>Please enter your access key</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="admin-input"
            placeholder="Key"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <div className="admin-error">{error}</div>}
          <button type="submit" className="admin-btn-primary">Login</button>
        </form>
      </div>
    </div>
  );
}
