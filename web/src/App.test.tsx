import { render, screen } from '@testing-library/react';
import App from './App';
import { BrowserRouter } from 'react-router-dom';

test('renders App component', () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
  // Just a basic test to make sure vitest can parse and run TSX correctly
  expect(true).toBe(true);
});
