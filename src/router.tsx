import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import EditorPage from './pages/EditorPage';
import TestStudioPage from './pages/TestStudioPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <UploadPage />,
  },
  {
    path: '/editor',
    element: <EditorPage />,
  },
  {
    path: '/test-studio',
    element: <TestStudioPage />,
  },
]);
