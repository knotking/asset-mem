import '@testing-library/jest-dom';

jest.mock('lucide-react', () => {
  const React = require('react');
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        return (props: Record<string, unknown>) =>
          React.createElement('span', { 'data-icon': String(prop), ...props });
      },
    },
  );
});
