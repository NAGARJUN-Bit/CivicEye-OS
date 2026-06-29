import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { IssueProvider } from './context/IssueContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IssueProvider>
      <App />
    </IssueProvider>
  </StrictMode>
);
