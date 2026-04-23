import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProfileProvider, useProfile } from './lib/profile';
import { initAdMob, showBanner, hideBanner } from './lib/admob';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import HomePage from './pages/HomePage';
import VideosPage from './pages/VideosPage';
import ShopPage from './pages/ShopPage';
import ProfilePage from './pages/ProfilePage';

function Gate() {
  const { loading, error, profile } = useProfile();

  useEffect(() => {
    initAdMob().then(() => {
      showBanner();
    });
    return () => {
      hideBanner();
    };
  }, []);

  if (loading) return <SplashScreen />;
  if (error && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Sem conexão</h1>
          <p className="text-on-surface-variant text-sm mb-6">{error}</p>
          <button
            className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl font-bold active:scale-95 transition-transform"
            onClick={() => window.location.reload()}
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ProfileProvider>
      <Gate />
    </ProfileProvider>
  );
}
