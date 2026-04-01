import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider } from '@fluentui/react-components'
import { darkTheme } from '@/lib/fluentui-theme'
import { App } from './App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={darkTheme}>
      <App />
    </FluentProvider>
  </StrictMode>
)
