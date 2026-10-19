import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx';
import './styles.css';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const root = document.documentElement;
const savedTheme = localStorage.getItem('theme');
const savedAnimations = localStorage.getItem('animations');
const savedPrimaryColor = localStorage.getItem('primaryColor');

if (savedTheme) root.dataset.theme = savedTheme;
if (savedAnimations) root.dataset.animations = savedAnimations;
if (savedPrimaryColor) root.style.setProperty('--accent', savedPrimaryColor);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
