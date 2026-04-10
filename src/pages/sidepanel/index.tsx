import React from 'react';
import { createRoot } from 'react-dom/client';
import '@pages/sidepanel/index.css';
import '@assets/styles/tailwind.css';
import Sidebar from '@pages/sidepanel/Sidebar';

function init() {
  const rootContainer = document.querySelector('#__root');
  if (!rootContainer) throw new Error("Can't find Sidebar root element");
  const root = createRoot(rootContainer);
  root.render(<Sidebar />);
}

init();
