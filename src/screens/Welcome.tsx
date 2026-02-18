import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Backdrop, CircularProgress, Stack, Card, CardContent, Fade, Divider, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { Celebration as CelebrationIcon, Groups as GroupsIcon, TipsAndUpdates as TipIcon, Email as EmailIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/useAuth';

const Welcome: React.FC = () => {
    const { profile, environment, loading: authLoading } = useAuth();
    const [name, setName] = useState('');
    const [partnerEmail, setPartnerEmail] = useState('');
    const [partnerSuccess, setPartnerSuccess] = useState('');
    const [showInviteInfo, setShowInviteInfo] = useState<{ open: boolean; email: string; link: string }>({ open: false, email: '', link: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!environment || !name.trim()) return;

        setLoading(true);
        try {
            await updateDoc(doc(db, 'environments', environment.id), {
                name: name.trim(),
                updatedAt: new Date().toISOString()
            });
            navigate('/');
        } catch (err) {
            console.error('Error saving portal name:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPartner = async () => {
        if (!environment || !partnerEmail || !profile) return;
        setLoading(true);

        const email = partnerEmail.toLowerCase().trim();

        try {
            const updatedMembers = [...environment.memberEmails, email];
            const envRef = doc(db, 'environments', environment.id);
            await updateDoc(envRef, {
                memberEmails: updatedMembers,
                [`memberNames.${email.replace(/\./g, '_')}`]: email
            });

            const registrationLink = `${window.location.origin}/register?email=${encodeURIComponent(email)}`;
            setPartnerSuccess(`Partner erfolgreich hinzugefügt!`);
            setShowInviteInfo({ open: true, email, link: registrationLink });
            setPartnerEmail('');
        } catch (e) {
            console.error('Error adding partner:', e);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 8, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
            <Fade in={true} timeout={1000}>
                <Box>
                    <Box sx={{ textAlign: 'center', mb: 6 }}>
                        <CelebrationIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h3" sx={{ fontWeight: 900, color: 'primary.dark', mb: 1 }}>
                            Willkommen!
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                            Schön, dass du da bist. Lass uns eure ABC Dates Reise starten!
                        </Typography>
                    </Box>

                    <Card sx={{ borderRadius: 3, boxShadow: '0 20px 40px rgba(0,0,0,0.08)', mb: 4, overflow: 'hidden' }}>
                        <CardContent sx={{ p: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
                                So funktioniert ABC Dates:
                            </Typography>

                            <Stack spacing={3}>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <GroupsIcon color="primary" />
                                    <Box>
                                        <Typography sx={{ fontWeight: 700 }}>Gemeinsam planen</Typography>
                                        <Typography variant="body2" color="text.secondary">Ihr seid abwechselnd an der Reihe. Jeder Buchstabe des Alphabets steht für ein neues Date.</Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TipIcon color="primary" />
                                    <Box>
                                        <Typography sx={{ fontWeight: 700 }}>KI-Unterstützung</Typography>
                                        <Typography variant="body2" color="text.secondary">Keine Idee? Unsere KI schlägt euch passende Aktivitäten basierend auf euren Vorlieben vor.</Typography>
                                    </Box>
                                </Box>
                            </Stack>

                            <Divider sx={{ my: 4 }} />

                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                                Wie soll eure ABC Date Reise heißen?
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Gib eurer Reise einen Namen, z.B. "Sophie & Mauro's Abenteuer".
                            </Typography>

                            <form onSubmit={handleSubmit}>
                                <TextField
                                    fullWidth
                                    label="Name eurer Reise"
                                    variant="outlined"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="z.B. Unsere Reise"
                                    required
                                    sx={{ mb: 4 }}
                                />

                                <Divider sx={{ my: 4 }} />

                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                                    Partner einladen
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Lade deinen Partner direkt ein, um die Reise gemeinsam zu starten.
                                </Typography>

                                <Box sx={{ display: 'flex', gap: 1, mb: 4 }}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="E-Mail des Partners"
                                        value={partnerEmail}
                                        onChange={(e) => setPartnerEmail(e.target.value)}
                                        disabled={loading}
                                    />
                                    <Button
                                        variant="outlined"
                                        onClick={handleAddPartner}
                                        disabled={loading || !partnerEmail}
                                    >
                                        Einladen
                                    </Button>
                                </Box>

                                {partnerSuccess && (
                                    <Typography variant="body2" color="success.main" sx={{ mb: 2, fontWeight: 600 }}>
                                        {partnerSuccess}
                                    </Typography>
                                )}

                                <Button
                                    fullWidth
                                    size="large"
                                    type="submit"
                                    variant="contained"
                                    disabled={loading || !name.trim()}
                                    sx={{
                                        py: 2,
                                        borderRadius: 3,
                                        fontWeight: 800,
                                        fontSize: '1.1rem',
                                        boxShadow: '0 8px 16px rgba(124, 77, 255, 0.3)'
                                    }}
                                >
                                    {loading ? <CircularProgress size={26} color="inherit" /> : 'Loslegen!'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Invitation Info Dialog (same as Settings) */}
                    <Dialog open={showInviteInfo.open} onClose={() => setShowInviteInfo({ ...showInviteInfo, open: false })} PaperProps={{ sx: { borderRadius: 4 } }}>
                        <DialogTitle sx={{ fontWeight: 700 }}>Partner eingeladen!</DialogTitle>
                        <DialogContent>
                            <DialogContentText sx={{ mb: 3 }}>
                                Dein Partner wurde erfolgreich hinzugefügt. Damit er Zugriff auf eure ABC Date Reise erhält, muss er sich registrieren oder einloggen.
                            </DialogContentText>

                            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Registrierungs-Link:</Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-all', fontWeight: 500 }}>{showInviteInfo.link}</Typography>
                            </Box>

                            <Stack spacing={1}>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    onClick={() => {
                                        const subject = encodeURIComponent('Einladung zu ABC Dates');
                                        const body = encodeURIComponent(`Hallo!\n\nIch habe uns bei ABC Dates angemeldet. Hier ist dein persönlicher Link zum Portal:\n\n${showInviteInfo.link}\n\nBis bald!`);
                                        window.location.href = `mailto:${showInviteInfo.email}?subject=${subject}&body=${body}`;
                                    }}
                                    startIcon={<EmailIcon />}
                                >
                                    Per E-Mail senden
                                </Button>
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => {
                                        navigator.clipboard.writeText(showInviteInfo.link);
                                        setPartnerSuccess('Link kopiert!');
                                        setShowInviteInfo({ ...showInviteInfo, open: false });
                                    }}
                                    startIcon={<CopyIcon />}
                                >
                                    Link kopieren
                                </Button>
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ p: 2, pt: 0 }}>
                            <Button onClick={() => setShowInviteInfo({ ...showInviteInfo, open: false })} color="inherit">Schließen</Button>
                        </DialogActions>
                    </Dialog>
                </Box>
            </Fade>

            <Backdrop open={loading} sx={{ zIndex: 9999, color: '#fff' }}>
                <CircularProgress color="inherit" />
            </Backdrop>
        </Container>
    );
};

export default Welcome;
