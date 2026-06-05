import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';

function TestProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, {
    wrapper: TestProviders,
    ...options,
  });
}

export * from '@testing-library/react';
