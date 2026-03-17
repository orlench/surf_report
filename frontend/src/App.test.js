import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/Dashboard', () => function MockDashboard() {
  return <div>dashboard</div>;
});

test('renders dashboard', () => {
  render(<App />);
  expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
});
