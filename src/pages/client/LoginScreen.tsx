import { useState } from 'react';
import Logo from '../../components/Logo';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

export default function LoginScreen({ onLogin, error, loading }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    await onLogin(username.trim(), password.trim());
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 70%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <Logo size="large" />

      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '2rem',
        width: '100%',
        maxWidth: 380,
        marginTop: '2rem',
        backdropFilter: 'blur(10px)',
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.4rem', fontSize: '1.2rem', color: '#fff', fontWeight: 700 }}>
          Entrar
        </h2>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Use as credenciais fornecidas pelo seu provedor
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem', fontWeight: 500 }}>
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Seu usuário"
              autoComplete="username"
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.07)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: '0.8rem 1rem',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#8B5CF6'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem', fontWeight: 500 }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '0.8rem 2.8rem 0.8rem 1rem',
                  color: '#fff',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#8B5CF6'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', fontSize: '1rem', padding: 0,
                }}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 8,
              padding: '0.65rem 0.9rem',
              color: '#ff6b7a',
              fontSize: '0.85rem',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            style={{
              background: loading ? 'rgba(139,92,246,0.5)' : 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '0.9rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.25rem',
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontFamily: 'inherit',
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Entrando...
              </>
            ) : 'Entrar'}
          </button>
        </form>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', marginTop: '1.5rem', textAlign: 'center' }}>
        Krator+
      </p>
    </div>
  );
}
