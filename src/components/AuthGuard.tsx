import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Box, CircularProgress } from '@mui/material';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, environment, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!user.emailVerified) {
        return <Navigate to="/verify-email" replace />;
    }

    // Redirect admins to welcome if portal name is missing
    const isAdmin = profile?.email?.toLowerCase().trim() === environment?.adminEmail?.toLowerCase().trim();
    if (isAdmin && !environment?.name && location.pathname !== '/welcome') {
        return <Navigate to="/welcome" replace />;
    }

    return <>{children}</>;
};
