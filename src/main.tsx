import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LiveStream from './components/LiveStream';
import './styles.css';
import './explore.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/\/live(?:\/index\.html|\/)?$/.test(window.location.pathname) ? <LiveStream /> : <App />}
  </React.StrictMode>,
);
