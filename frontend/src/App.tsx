/**
 * Ada Analysis & Test Generation Tool
 * Author: Rakshitha
 * GitHub: https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool
 * License: MIT © 2025 Rakshitha
 */
import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { Toast } from './components/shared/Toast';

const App: React.FC = () => {
  return (
    <>
      <RouterProvider router={router} />
      <Toast />
    </>
  );
};

export default App;
