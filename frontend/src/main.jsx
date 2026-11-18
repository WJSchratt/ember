import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';
import PickupApp from './pickup/PickupApp.jsx';
import { PICKUP_ONLY } from './flags.js';
import './index.css';

// PICKUP_ONLY (default on): render only the McGuire Fields pickup app. The
// full Tether app below is paused, not removed - set VITE_PICKUP_ONLY=false.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {PICKUP_ONLY ? (
        <PickupApp />
      ) : (
        <AuthProvider>
          <App />
        </AuthProvider>
      )}
    </BrowserRouter>
  </StrictMode>
);
