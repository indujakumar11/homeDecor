import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.scss';

// Admin password-recovery links land on the site root with the recovery
// tokens in the URL hash (see authService.js's HASH-ROUTER note). Supabase
// announces the recovery (PASSWORD_RECOVERY) only once, right after its
// client reads those tokens, and only to listeners that already exist — and
// authService.js is what listens, then moves on to #/admin/reset-password.
// So on that landing, load authService (which also creates the client) right
// away. Ordinary visits never match and never load it.
const { hash } = window.location;
if (/[#&]type=recovery(&|$)/.test(hash) && /[#&]access_token=/.test(hash)) {
  import('./services/authService');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
