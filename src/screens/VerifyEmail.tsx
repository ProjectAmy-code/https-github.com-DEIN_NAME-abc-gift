import React, { useState } from 'react';
import { Container, Box, Typography, Button, Card, CardContent, Alert, Fade, Link } from '@mui/material';
import { Mail as MailIcon, Refresh as RefreshIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const VerifyEmail: React.FC = () => {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleResend = async () => {
        if (!user) return;
        setError('');
        setMessage('');
        setLoading(true);

        try {
            await sendEmailVerification(user);
            setMessage('Neue Verifizierungs-E-Mail wurde gesendet!');
        } catch (err: any) {
            console.error('Resend Error:', err);
            setError(`Fehler beim Senden: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckStatus = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await user.reload();
            if (auth.currentUser?.emailVerified) {
                navigate('/');
            } else {
                setError('E-Mail ist noch nicht verifiziert. Bitte schau in dein Postfach.');
            }
        } catch (err: any) {
            setError(`Fehler beim Aktualisieren: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await auth.signOut();
        navigate('/login');
    };

    return (
        <Container maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Fade in={true} timeout={1000}>
                <Box>
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Typography variant="h3" sx={{ fontWeight: 900, color: 'primary.main', mb: 1 }}>
                            ABC Dates
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                            E-Mail Verifizierung
                        </Typography>
                    </Box>

                    <Card sx={{ borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(0,0,0,0.1)' }}>
                        <CardContent sx={{ p: 4 }}>
                            <Box sx={{ textAlign: 'center', mb: 3 }}>
                                <MailIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, opacity: 0.8 }} />
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                    Bitte verifiziere deine E-Mail
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Wir haben eine Nachricht an <strong>{user?.email}</strong> gesendet. Klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.
                                </Typography>
                            </Box>

                            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                            {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}

                            <Button
                                fullWidth
                                size="large"
                                onClick={handleCheckStatus}
                                variant="contained"
                                disabled={loading}
                                startIcon={<RefreshIcon />}
                                sx={{ py: 1.5, borderRadius: 2, fontWeight: 700, mb: 2 }}
                            >
                                Status prüfen
                            </Button>

                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={handleResend}
                                disabled={loading}
                                sx={{ py: 1.2, borderRadius: 2, fontWeight: 600, mb: 3 }}
                            >
                                E-Mail erneut senden
                            </Button>

                            <Box sx={{ textAlign: 'center' }}>
                                <Link
                                    component="button"
                                    onClick={handleLogout}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        color: 'text.secondary',
                                        textDecoration: 'none',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        margin: '0 auto'
                                    }}
                                >
                                    <LogoutIcon sx={{ fontSize: 18, mr: 0.5 }} />
                                    Abmelden & zurück
                                </Link>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            </Fade>
        </Container>
    );
};

export default VerifyEmail;
