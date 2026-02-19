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

    // Redirect admins to welcome only for brand-new portals (created within last 5 min and no name)
    const isAdmin = profile?.email?.toLowerCase().trim() === environment?.adminEmail?.toLowerCase().trim();
    const isNewEnvironment = environment?.createdAt && (Date.now() - new Date(environment.createdAt).getTime() < 5 * 60 * 1000);
    if (isAdmin && !environment?.name && isNewEnvironment && location.pathname !== '/welcome') {
        return <Navigate to="/welcome" replace />;
    }

    return <>{children}</>;
};
