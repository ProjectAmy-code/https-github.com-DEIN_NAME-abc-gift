import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, TextField, Button, Card, CardContent, InputAdornment, IconButton, Alert, Fade, Link } from '@mui/material';
import { Email as EmailIcon, Lock as LockIcon, Visibility, VisibilityOff, Person as PersonIcon } from '@mui/icons-material';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';
import { storage } from '../storage';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';

const Register: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isEmailPreFilled, setIsEmailPreFilled] = useState(false);

    useEffect(() => {
        const emailParam = searchParams.get('email');
        if (emailParam) {
            setEmail(emailParam);
            setIsEmailPreFilled(true);
        }
    }, [searchParams]);

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
            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const user = userCredential.user;
            const userEmail = email.toLowerCase().trim();

            // 1. Check for existing invitations
            const envsRef = collection(db, 'environments');
            const q1 = query(envsRef, where('memberEmails', 'array-contains', userEmail));
            const envSnap1 = await getDocs(q1);

            let envId: string;

            if (!envSnap1.empty) {
                // Join existing environment
                const existingEnv = envSnap1.docs[0];
                envId = existingEnv.id;

                await updateDoc(doc(db, 'environments', envId), {
                    [`memberNames.${userEmail.replace(/\./g, '_')}`]: name
                });
            } else {
                // Try original case search just in case of legacy data
                const q2 = query(envsRef, where('memberEmails', 'array-contains', email.trim()));
                const envSnap2 = await getDocs(q2);

                if (!envSnap2.empty) {
                    envId = envSnap2.docs[0].id;
                    await updateDoc(doc(db, 'environments', envId), {
                        [`memberNames.${userEmail.replace(/\./g, '_')}`]: name
                    });
                } else {
                    // Create new environment
                    envId = doc(collection(db, 'id-placeholder')).id; // generate unique id
                    await setDoc(doc(db, 'environments', envId), {
                        id: envId,
                        memberEmails: [userEmail],
                        memberNames: { [userEmail.replace(/\./g, '_')]: name },
                        startingPersonEmail: userEmail,
                        adminEmail: userEmail, // First user is admin
                        createdAt: new Date().toISOString()
                    });

                    // Initialize default rounds and settings for new environment
                    await storage.initializeEnvironment(envId, [userEmail], userEmail);
                }
            }

            // 2. Create user profile doc
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: userEmail,
                environmentId: envId,
                displayName: name
            });

            // Send verification email
            await sendEmailVerification(user);
            // Firebase signs in the user automatically, so we sign them out immediately
            await auth.signOut();
            setSuccess(true);
            setName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            console.error('Registration Error:', err);
            let errorMessage = `Registrierung fehlgeschlagen (${err.code || err.message})`;

            if (err.code === 'auth/email-already-in-use') {
                errorMessage = (
                    <span>
                        Diese E-Mail-Adresse wird bereits verwendet.
                        <Link component={RouterLink} to="/login" sx={{ ml: 1, color: 'inherit', textDecoration: 'underline', fontWeight: 700 }}>
                            Hier anmelden
                        </Link>, um ausstehende Einladungen anzunehmen.
                    </span>
                ) as any;
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
                                            label="Name"
                                            variant="outlined"
                                            margin="normal"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <PersonIcon color="action" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                            sx={{ mb: 1 }}
                                        />
                                        <TextField
                                            fullWidth
                                            label="E-Mail-Adresse"
                                            variant="outlined"
                                            margin="normal"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            type="email"
                                            required
                                            disabled={isEmailPreFilled}
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
