import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { de } from 'date-fns/locale'
import theme from './theme'
import Navigation from './components/Navigation'
import Home from './screens/Home'
import History from './screens/History'
import Settings from './screens/Settings'
import LetterDetail from './screens/LetterDetail'
import Login from './screens/Login'
import Register from './screens/Register'
import ForgotPassword from './screens/ForgotPassword'
import VerifyEmail from './screens/VerifyEmail'
import { AuthProvider } from './context/AuthProvider'
import { AuthGuard } from './components/AuthGuard'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
        <AuthProvider>
          <CssBaseline />
          <BrowserRouter>
            <Box sx={{ pb: 7, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/" element={<AuthGuard><Home /></AuthGuard>} />
                <Route path="/letter/:letter" element={<AuthGuard><LetterDetail /></AuthGuard>} />
                <Route path="/history" element={<AuthGuard><History /></AuthGuard>} />
                <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <Navigation />
            </Box>
          </BrowserRouter>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  </StrictMode>,
)
