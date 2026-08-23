import React, { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { Provider as JotaiProvider } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import userEvent from '@testing-library/user-event'

// Atom hydration helper for Jotai
type InitialValues = Array<readonly [any, any]>

function HydrateAtoms({ initialValues, children }: { initialValues: InitialValues; children: React.ReactNode }) {
  useHydrateAtoms(initialValues)
  return <>{children}</>
}

type AllProvidersProps = {
  children: React.ReactNode
  routerProps?: MemoryRouterProps
  initialAtoms?: InitialValues
}

function AllProviders({ children, routerProps, initialAtoms = [] }: AllProvidersProps) {
  return (
    <JotaiProvider>
      <HydrateAtoms initialValues={initialAtoms}>
        <MemoryRouter {...routerProps}>
          {children}
        </MemoryRouter>
      </HydrateAtoms>
    </JotaiProvider>
  )
}

type CustomRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  routerProps?: MemoryRouterProps
  initialAtoms?: InitialValues
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { routerProps, initialAtoms, ...renderOptions } = options
  const user = userEvent.setup()

  return {
    user,
    ...render(ui, {
      wrapper: ({ children }) => (
        <AllProviders routerProps={routerProps} initialAtoms={initialAtoms}>
          {children}
        </AllProviders>
      ),
      ...renderOptions,
    }),
  }
}

export { render, screen, within, waitFor, act } from '@testing-library/react'
export { userEvent }
