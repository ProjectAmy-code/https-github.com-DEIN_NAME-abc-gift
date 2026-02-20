import React from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { Favorite as HeartIcon } from '@mui/icons-material';
import { APP_VERSION } from '../version';

const AppFooter: React.FC = () => {
    return (
        <Box sx={{
            mt: 'auto',
            pt: 4,
            pb: 2,
            textAlign: 'center'
        }}>
            <Divider sx={{ mb: 2, opacity: 0.3 }} />
            <Typography
                variant="caption"
                sx={{
                    color: 'text.disabled',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    fontSize: '0.7rem',
                    letterSpacing: '0.02em'
                }}
            >
                Entwickelt mit <HeartIcon sx={{ fontSize: 12, color: '#e53935' }} /> in Deutschland
            </Typography>
            <Typography
                variant="caption"
                sx={{
                    color: 'text.disabled',
                    fontSize: '0.65rem',
                    opacity: 0.6,
                    mt: 0.5,
                    display: 'block'
                }}
            >
                {APP_VERSION}
            </Typography>
        </Box>
    );
};

export default AppFooter;
