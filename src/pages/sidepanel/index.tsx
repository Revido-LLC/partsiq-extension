import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles/tailwind.css';
import Sidebar from './Sidebar';

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <Sidebar />
  </StrictMode>
);
