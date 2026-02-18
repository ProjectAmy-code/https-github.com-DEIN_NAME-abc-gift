import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Card, CardContent, InputAdornment, IconButton, Alert, Fade, Link } from '@mui/material';
import { Email as EmailIcon, Lock as LockIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { Link as RouterLink } from 'react-router-dom';

const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (password !== confirmPassword) {
            return setError('Passwörter stimmen nicht überein.');
        }

        if (password.length < 6) {
            return setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
        }

        setLoading(true);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Send verification email
            await sendEmailVerification(userCredential.user);
            // Firebase signs in the user automatically, so we sign them out immediately
            await auth.signOut();
            setSuccess(true);
            setEmail('');
            setPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            console.error('Registration Error:', err);
            let errorMessage = `Registrierung fehlgeschlagen (${err.code || err.message})`;

            if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'Diese E-Mail-Adresse wird bereits verwendet.';
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Ungültige E-Mail-Adresse.';
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = 'Netzwerkfehler. Bitte überprüfe deine Verbindung.';
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
                            Erstelle ein Konto, um zu starten.
                        </Typography>
                    </Box>

                    <Card sx={{ borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(0,0,0,0.1)' }}>
                        <CardContent sx={{ p: 4 }}>
                            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                            {success ? (
                                <Box sx={{ textAlign: 'center' }}>
                                    <Alert severity="success" sx={{ mb: 3 }}>
                                        Konto erfolgreich erstellt! Wir haben dir eine Verifizierungs-E-Mail gesendet. Bitte bestätige deine E-Mail, bevor du dich anmeldest.
                                    </Alert>
                                    <Button
                                        fullWidth
                                        size="large"
                                        component={RouterLink}
                                        to="/login"
                                        variant="contained"
                                        sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                                    >
                                        Jetzt anmelden
                                    </Button>
                                </Box>
                            ) : (
                                <>
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
                                            required
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
                                            sx={{ mb: 2 }}
                                        />
                                        <TextField
                                            fullWidth
                                            label="Passwort bestätigen"
                                            type={showPassword ? 'text' : 'password'}
                                            variant="outlined"
                                            margin="normal"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <LockIcon color="action" />
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
                                            {loading ? 'Wird registriert...' : 'Registrieren'}
                                        </Button>
                                    </form>

                                    <Box sx={{ mt: 3, textAlign: 'center' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Hast du bereits ein Konto?{' '}
                                            <Link component={RouterLink} to="/login" sx={{ fontWeight: 700, color: 'primary.main', textDecoration: 'none' }}>
                                                Anmelden
                                            </Link>
                                        </Typography>
                                    </Box>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </Box>
            </Fade>
        </Container>
    );
};

export default Register;
