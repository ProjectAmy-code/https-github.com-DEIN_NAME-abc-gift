import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Card, CardContent, InputAdornment, IconButton, Alert, Fade } from '@mui/material';
import { Email as EmailIcon, Lock as LockIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err: any) {
            console.error('Full Login Error:', err);
            let errorMessage = `Login fehlgeschlagen (${err.code || err.message})`;

            if (err.code === 'auth/invalid-credential') {
                errorMessage = 'Ungültige Zugangsdaten. Bitte überprüfe E-Mail und Passwort.';
            } else if (err.code === 'auth/api-key-not-valid') {
                errorMessage = 'Firebase Fehler: Der API-Key wird von Google abgelehnt. Bitte Seite neu laden oder Cache leeren.';
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
                            Bitte melde dich an, um fortzufahren.
                        </Typography>
                    </Box>

                    <Card sx={{ borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(0,0,0,0.1)' }}>
                        <CardContent sx={{ p: 4 }}>
                            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                            <form onSubmit={handleSubmit}>
                                <TextField
                                    fullWidth
                                    label="E-Mail-Adresse"
                                    variant="outlined"
                                    margin="normal"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailIcon color="action" />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ mb: 2 }}
                                />
                                <TextField
                                    fullWidth
                                    label="Passwort"
                                    type={showPassword ? 'text' : 'password'}
                                    variant="outlined"
                                    margin="normal"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockIcon color="action" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
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
                                    {loading ? 'Wird angemeldet...' : 'Anmelden'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </Box>
            </Fade>
        </Container>
    );
};

export default Login;
