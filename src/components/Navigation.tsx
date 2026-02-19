import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { Home as HomeIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const Navigation: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    if (!user) return null;

    // Hide navigation on auth and verification screens
    const hideOnPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/welcome'];
    if (hideOnPaths.includes(location.pathname)) return null;

    const getValue = () => {
        if (location.pathname === '/') return 0;
        if (location.pathname === '/settings') return 1;
        return 0;
    };

    return (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
            <BottomNavigation
                showLabels
                value={getValue()}
                onChange={(_, newValue) => {
                    if (newValue === 0) navigate('/');
                    if (newValue === 1) navigate('/settings');
                }}
            >
                <BottomNavigationAction label="Home" icon={<HomeIcon />} onClick={() => navigate('/')} />
                <BottomNavigationAction label="Einstellungen" icon={<SettingsIcon />} onClick={() => navigate('/settings')} />
            </BottomNavigation>
        </Paper>
    );
};

export default Navigation;
