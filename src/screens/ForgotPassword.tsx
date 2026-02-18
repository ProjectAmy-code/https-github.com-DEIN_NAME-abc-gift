import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Card, CardContent, InputAdornment, Alert, Fade, Link } from '@mui/material';
import { Email as EmailIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Link as RouterLink } from 'react-router-dom';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('E-Mail zum Zurücksetzen des Passworts wurde gesendet! Bitte schau in dein Postfach.');
        } catch (err: any) {
            console.error('Password Reset Error:', err);
            let errorMessage = `Fehler beim Senden der E-Mail (${err.code || err.message})`;

            if (err.code === 'auth/user-not-found') {
                errorMessage = 'Kein Benutzer mit dieser E-Mail-Adresse gefunden.';
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Ungültige E-Mail-Adresse.';
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
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
                            Passwort zurücksetzen
                        </Typography>
                    </Box>

                    <Card sx={{ borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(0,0,0,0.1)' }}>
                        <CardContent sx={{ p: 4 }}>
                            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                            {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}

                            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                                Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.
                            </Typography>

                            <form onSubmit={handleSubmit}>
                                <TextField
                                    fullWidth
                                    label="E-Mail-Adresse"
                                    variant="outlined"
                                    margin="normal"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    required
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailIcon color="action" />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ mb: 3 }}
                                />
                                <Button
                                    fullWidth
                                    size="large"
                                    type="submit"
                                    variant="contained"
                                    disabled={loading}
                                    sx={{
                                        py: 1.5,
                                        borderRadius: 2,
                                        fontWeight: 700,
                                        textTransform: 'none',
                                        fontSize: '1.1rem'
                                    }}
                                >
                                    {loading ? 'Senden...' : 'Link anfordern'}
                                </Button>
                            </form>

                            <Box sx={{ mt: 3, textAlign: 'center' }}>
                                <Link
                                    component={RouterLink}
                                    to="/login"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        color: 'primary.main',
                                        textDecoration: 'none'
                                    }}
                                >
                                    <ArrowBackIcon sx={{ fontSize: 18, mr: 0.5 }} />
                                    Zurück zum Login
                                </Link>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            </Fade>
        </Container>
    );
};

export default ForgotPassword;
