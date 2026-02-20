import React, { useEffect, useState, useCallback } from 'react';
import { Container, Typography, Card, CardContent, Chip, List, ListItem, ListItemText, Box, Divider, ListItemButton, Button, IconButton, Stack, Dialog, DialogTitle, DialogContent, CircularProgress, DialogActions, Snackbar, Alert } from '@mui/material';
import { ChevronRight as ChevronRightIcon, History as HistoryIcon, Settings as SettingsIcon, EmojiEvents as TrophyIcon, Celebration as PartyIcon, LocalActivity as ActivityIcon, CheckCircle as CheckCircleIcon, Star as StarIcon, StarOutline as StarOutlineIcon, WhatsApp as WhatsAppIcon, Email as EmailIcon, Campaign as CampaignIcon, ContentCopy as CopyIcon, AutoAwesome as AIPreviewIcon, Casino as CasinoIcon, Share as ShareIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { storage } from '../storage';
import { useAuth } from '../context/useAuth';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import type { LetterRound, Environment, UserPreferences } from '../types';
import { RoundStatus } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import SocialShareDialog from '../components/SocialShareDialog';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const Home: React.FC = () => {
    const { profile, environment, loading: authLoading } = useAuth();
    const [rounds, setRounds] = useState<LetterRound[]>([]);
    const [pendingInvite, setPendingInvite] = useState<Environment | null>(null);
    const [isAccepting, setIsAccepting] = useState(false);
    const [showRemindCopySuccess, setShowRemindCopySuccess] = useState(false);
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);

    const [showRemindDialog, setShowRemindDialog] = useState(false);
    const [shareRound, setShareRound] = useState<LetterRound | null>(null);
    const navigate = useNavigate();

    // Random mode state
    const [isDrawing, setIsDrawing] = useState(false);
    const [spinLetter, setSpinLetter] = useState<string | null>(null);
    const [drawnLetter, setDrawnLetter] = useState<string | null>(null);
    const [animationPhase, setAnimationPhase] = useState<'idle' | 'spinning' | 'revealed' | 'transitioning'>('idle');
    const [drawnProposer, setDrawnProposer] = useState<string | null>(null);

    const isRandomMode = environment?.abcMode === 'random';
    const drawnOrder = environment?.drawnOrder || [];

    useEffect(() => {
        if (environment?.id) {
            storage.getRounds(environment.id).then(setRounds);
            storage.getPreferences(environment.id, profile?.email).then(setPreferences);
        } else if (profile && !authLoading) {
            // Search for invitations
            const checkInvites = async () => {
                const normalizedProfileEmail = profile.email.toLowerCase().trim();
                const emailsToSearch = [profile.email.trim(), normalizedProfileEmail];
                // Remove duplicates
                const uniqueEmails = [...new Set(emailsToSearch)];

                for (const email of uniqueEmails) {
                    const q = query(collection(db, 'environments'), where('memberEmails', 'array-contains', email));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        const envData = snap.docs[0].data() as Environment;
                        setPendingInvite(envData);
                        break; // Found one, stop searching
                    }
                }
            };
            checkInvites();
        }
    }, [environment, profile, authLoading]);

    const handleAcceptInvite = async () => {
        if (!pendingInvite || !profile) return;
        setIsAccepting(true);
        try {
            const userRef = doc(db, 'users', profile.uid);
            const normalizedEmail = profile.email.toLowerCase().trim();
            await updateDoc(userRef, {
                environmentId: pendingInvite.id,
                email: normalizedEmail
            });
            window.location.reload();
        } catch (e) {
            console.error('Error accepting invite:', e);
        } finally {
            setIsAccepting(false);
        }
    };

    const getDisplayName = (email: string) => {
        if (!environment) return email;
        const normalizedEmail = email.toLowerCase().replace(/\./g, '_');
        return environment.memberNames[normalizedEmail] || email;
    };

    const getNextRound = () => {
        if (rounds.length === 0) return null;

        if (isRandomMode) {
            // In random mode: find the last drawn letter's round that is not Done
            if (drawnOrder.length === 0) return null;
            // Go through drawnOrder and find the latest non-Done round
            for (let i = drawnOrder.length - 1; i >= 0; i--) {
                const round = rounds.find(r => r.letter === drawnOrder[i]);
                if (round && round.status !== RoundStatus.Done) return round;
            }
            // All drawn are done; return null (shows draw button)
            return null;
        }

        // Sequential: Find the FIRST round alphabetically that is not "Done"
        return rounds.find(r => r.status !== RoundStatus.Done) || rounds[rounds.length - 1];
    };

    const currentRound = getNextRound();

    // Random mode: can we draw the next letter?
    const canDrawNext = useCallback(() => {
        if (!isRandomMode || !environment) return false;
        if (drawnOrder.length >= 26) return false; // All letters drawn

        if (drawnOrder.length === 0) return true; // First draw always possible

        // The last drawn letter must be at least "Planned"
        const lastDrawnLetter = drawnOrder[drawnOrder.length - 1];
        const lastRound = rounds.find(r => r.letter === lastDrawnLetter);
        if (!lastRound) return true;

        return lastRound.status === RoundStatus.Planned || lastRound.status === RoundStatus.Done;
    }, [isRandomMode, environment, drawnOrder, rounds]);

    const handleDrawLetter = async () => {
        if (!environment || !canDrawNext() || isDrawing) return;

        setIsDrawing(true);
        setDrawnLetter(null);
        setAnimationPhase('spinning');
        setDrawnProposer(null);

        const drawnSet = new Set(drawnOrder);
        const remaining = ALPHABET.filter(l => !drawnSet.has(l));
        if (remaining.length === 0) { setIsDrawing(false); setAnimationPhase('idle'); return; }

        // Pick the actual result
        const memberOrder = environment.memberOrder || environment.memberEmails;
        const result = await storage.drawNextLetter(environment.id, drawnOrder, memberOrder);
        if (!result) { setIsDrawing(false); setAnimationPhase('idle'); return; }

        // Spinning animation: start fast, decelerate
        let spinCount = 0;
        const totalSpins = 24;
        const spin = () => {
            if (spinCount >= totalSpins) {
                // Phase 2: Reveal
                setSpinLetter(result.letter);
                setDrawnLetter(result.letter);
                setAnimationPhase('revealed');
                setDrawnProposer(result.round.proposerUserId);

                // Update drawnOrder in Firestore
                const newDrawnOrder = [...drawnOrder, result.letter];
                updateDoc(doc(db, 'environments', environment.id), {
                    drawnOrder: newDrawnOrder
                }).catch(e => console.error('Error updating drawnOrder:', e));

                // Refresh rounds
                storage.getRounds(environment.id).then(setRounds);

                // Phase 3: Transition to planning card after hold
                setTimeout(() => {
                    setAnimationPhase('transitioning');
                    setTimeout(() => {
                        setIsDrawing(false);
                        setAnimationPhase('idle');
                        setDrawnLetter(null);
                    }, 800);
                }, 2500);
                return;
            }

            const randomIdx = Math.floor(Math.random() * remaining.length);
            setSpinLetter(remaining[randomIdx]);
            spinCount++;
            // Decelerate: start at 50ms, end at ~180ms
            const delay = 50 + (spinCount / totalSpins) * 130;
            setTimeout(spin, delay);
        };
        spin();
    };

    const getStatusLabel = (status: RoundStatus) => {
        switch (status) {
            case RoundStatus.Done: return 'Erledigt';
            case RoundStatus.Planned: return 'Geplant';
            case RoundStatus.Draft: return 'Entwurf';
            default: return 'Nicht gestartet';
        }
    };

    const getStatusColor = (status: RoundStatus): "success" | "primary" | "warning" | "default" => {
        switch (status) {
            case RoundStatus.Done: return 'success';
            case RoundStatus.Planned: return 'primary';
            case RoundStatus.Draft: return 'warning';
            default: return 'default';
        }
    };

    const [ratingRound, setRatingRound] = useState<LetterRound | null>(null);

    const handleMarkAsDone = (round: LetterRound) => {
        setRatingRound(round);
    };

    const submitRating = async (rating: number) => {
        if (!ratingRound || !environment || !profile) return;
        const normalizedEmail = profile.email.toLowerCase().trim();
        const updates: Partial<LetterRound> = {
            status: RoundStatus.Done,
            ratings: {
                ...(ratingRound.ratings || {}),
                [normalizedEmail]: rating
            },
            updatedAt: new Date().toISOString()
        };

        // Also update legacy rating as average for now
        const allRatings = Object.values(updates.ratings || {});
        if (allRatings.length > 0) {
            updates.rating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
        }

        const allRounds = await storage.getRounds(environment.id);
        const newRounds = allRounds.map((r: LetterRound) => r.letter === ratingRound.letter ? { ...r, ...updates } : r);
        await storage.saveRounds(environment.id, newRounds);
        setRounds(newRounds);
        setRatingRound(null);
    };

    if (authLoading || (environment && rounds.length === 0)) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Typography color="text.secondary">Lade Daten...</Typography>
            </Box>
        );
    }

    if (!environment) {
        return (
            <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, color: 'primary.main' }}>
                    Willkommen!
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Du bist momentan keinem Portal zugeordnet.
                </Typography>

                {pendingInvite ? (
                    <Dialog open={!!pendingInvite} PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
                        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center' }}>Einladung erhalten!</DialogTitle>
                        <DialogContent>
                            <Box sx={{ textAlign: 'center', mb: 3 }}>
                                <PartyIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                                <Typography variant="h6" gutterBottom>
                                    Du wurdest zu einem Portal eingeladen!
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Möchtest du dem Portal beitreten?
                                </Typography>
                            </Box>
                            <Stack spacing={2}>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    size="large"
                                    onClick={handleAcceptInvite}
                                    disabled={isAccepting}
                                    sx={{ fontWeight: 700, borderRadius: 3 }}
                                >
                                    {isAccepting ? <CircularProgress size={24} color="inherit" /> : 'Jetzt beitreten'}
                                </Button>
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => auth.signOut().then(() => navigate('/login'))}
                                    sx={{ fontWeight: 700, borderRadius: 3 }}
                                >
                                    Mit anderem Konto anmelden
                                </Button>
                            </Stack>
                        </DialogContent>
                    </Dialog>
                ) : (
                    <Button variant="contained" onClick={() => navigate('/settings')} sx={{ mt: 2 }}>
                        Zum Profil
                    </Button>
                )}
            </Container>
        );
    }

    // For sequential mode, we need currentRound
    if (!isRandomMode && (rounds.length === 0 || !currentRound)) return null;

    const isPlanned = currentRound?.status === RoundStatus.Planned;
    const needsPlanning = !isPlanned;
    const isProposer = profile?.email?.toLowerCase().trim() === currentRound?.proposerUserId?.toLowerCase().trim();

    const handleRemind = (method: 'whatsapp' | 'email') => {
        if (!environment || !currentRound) return;

        const proposerName = getDisplayName(currentRound.proposerUserId);
        const appUrl = window.location.origin;
        const subject = `Erinnerung: ABC Dates - Buchstabe ${currentRound.letter}`;
        const message = `Hallo ${proposerName}, du bist bei ABC Dates für den Buchstaben ${currentRound.letter} an der Reihe! 🎉 Hast du schon eine Idee? \n\nJetzt anmelden: ${appUrl}`;

        if (method === 'whatsapp') {
            const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
        } else {
            const url = `mailto:${currentRound.proposerUserId}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
            window.location.href = url;
        }
        setShowRemindDialog(false);
    };

    const handleCopyLink = () => {
        const appUrl = window.location.origin;
        navigator.clipboard.writeText(appUrl);
        setShowRemindCopySuccess(true);
        setShowRemindDialog(false);
    };

    // Random mode: compute the rounds to display in timeline (only drawn letters)
    const timelineRounds = isRandomMode
        ? drawnOrder.map(letter => rounds.find(r => r.letter === letter)).filter(Boolean) as LetterRound[]
        : rounds;

    // Random mode: determine the "last drawn" status for the draw button hint
    const lastDrawnLetter = drawnOrder.length > 0 ? drawnOrder[drawnOrder.length - 1] : null;
    const lastDrawnRound = lastDrawnLetter ? rounds.find(r => r.letter === lastDrawnLetter) : null;
    const allLettersDrawn = drawnOrder.length >= 26;

    // Calculate target date based on rhythm setting
    const getTargetDateText = () => {
        if (!environment || !environment.eventInterval || !needsPlanning) return null;

        let baselineDate = new Date(environment.createdAt);

        // Find the last completed or planned date
        const allPastRounds = isRandomMode
            ? drawnOrder.map(l => rounds.find(r => r.letter === l)).filter(Boolean) as LetterRound[]
            : rounds;

        const sortedPastRounds = [...allPastRounds]
            .filter(r => r.date && (r.status === RoundStatus.Done || r.status === RoundStatus.Planned))
            .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

        if (sortedPastRounds.length > 0 && sortedPastRounds[0].date) {
            baselineDate = new Date(sortedPastRounds[0].date);
        }

        const targetDate = new Date(baselineDate);
        const { value, unit } = environment.eventInterval;

        if (unit === 'days') {
            targetDate.setDate(targetDate.getDate() + value);
        } else if (unit === 'weeks') {
            targetDate.setDate(targetDate.getDate() + (value * 7));
        } else if (unit === 'months') {
            targetDate.setMonth(targetDate.getMonth() + value);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);

        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { text: `Tipp: Euer Date ist seit ${Math.abs(diffDays)} Tag(en) überfällig!`, color: 'error.main' };
        } else if (diffDays === 0) {
            return { text: 'Tipp: Euer nächstes Date sollte heute stattfinden!', color: 'warning.main' };
        } else {
            return { text: `Tipp: Euer nächstes Date sollte in ${diffDays} Tag(en) stattfinden.`, color: 'text.secondary' };
        }
    };

    const targetDateInfo = getTargetDateText();

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" sx={{ color: 'primary.dark', fontWeight: 800 }}>
                        {environment?.name || 'ABC Dates'}
                    </Typography>
                    {environment?.name && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mt: -0.5 }}>
                            ABC Dates Portal
                        </Typography>
                    )}
                </Box>
                <Box>
                    <IconButton onClick={() => navigate('/settings')}><SettingsIcon color="primary" /></IconButton>
                </Box>
            </Box>

            {environment && (!preferences || !preferences.completedAt) && (
                <Card sx={{ mb: 4, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.100', borderRadius: 3 }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '16px !important' }}>
                        <AIPreviewIcon color="primary" />
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.dark' }}>Setup abschließen</Typography>
                            <Typography variant="caption" color="text.secondary">Personalisiere deine KI-Vorschläge für bessere Dates.</Typography>
                        </Box>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => navigate('/onboarding')}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                        >
                            Starten
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ===== RANDOM MODE: Draw Card ===== */}
            {isRandomMode && (isDrawing || (!currentRound || (currentRound && currentRound.status === RoundStatus.Done && !allLettersDrawn) || drawnOrder.length === 0)) && !allLettersDrawn && (
                <AnimatePresence mode="wait">
                    {animationPhase === 'transitioning' && drawnLetter && drawnProposer ? (
                        /* Phase 3: Morphing into the planning card */
                        <motion.div
                            key="planning-card"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                        >
                            <Card sx={{
                                mb: 6,
                                background: 'linear-gradient(135deg, #FF9800 0%, #F44336 100%)',
                                color: 'white',
                                position: 'relative',
                                overflow: 'visible'
                            }}>
                                <CardContent sx={{ textAlign: 'center', py: 5 }}>
                                    <Typography variant="overline" sx={{ opacity: 0.9, fontWeight: 700, letterSpacing: '0.1em' }}>
                                        Nächste Planung
                                    </Typography>
                                    <Box sx={{ position: 'relative', py: 2 }}>
                                        <Typography variant="h3" sx={{ my: 2, fontWeight: 800, position: 'relative', zIndex: 1 }}>
                                            {getDisplayName(drawnProposer)} ist dran!
                                        </Typography>
                                        <Typography variant="h1" sx={{ fontSize: { xs: '6rem', sm: '8rem' }, opacity: 0.15, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 0, fontWeight: 900 }}>
                                            {drawnLetter}
                                        </Typography>
                                    </Box>
                                    {targetDateInfo && (
                                        <Typography variant="body2" sx={{ mt: 1, mb: 2, fontWeight: 600, bgcolor: 'rgba(255,255,255,0.2)', py: 0.5, px: 2, borderRadius: 2, display: 'inline-block' }}>
                                            {targetDateInfo.text}
                                        </Typography>
                                    )}
                                    <br />
                                    <Button
                                        variant="contained"
                                        size="large"
                                        sx={{ backgroundColor: 'white !important', backgroundImage: 'none !important', color: '#d84315 !important', fontWeight: 900, px: 4, borderRadius: 3, boxShadow: '0 4px 14px 0 rgba(0,0,0,0.1)', textTransform: 'none', '&:hover': { backgroundColor: '#f5f5f5 !important' }, mt: 2 }}
                                        onClick={() => navigate(`/letter/${drawnLetter}`)}
                                    >
                                        Jetzt planen
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : (
                        /* Phase 0 (idle) + Phase 1 (spinning) + Phase 2 (revealed) */
                        <motion.div
                            key="draw-card"
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.4 }}
                        >
                            <Card sx={{
                                mb: 6,
                                background: 'linear-gradient(135deg, #00BCD4 0%, #7C4DFF 100%)',
                                color: 'white',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <CardContent sx={{ textAlign: 'center', py: 5 }}>
                                    <Typography variant="overline" sx={{ opacity: 0.9, fontWeight: 700, letterSpacing: '0.1em' }}>
                                        Zufallsmodus
                                    </Typography>

                                    {animationPhase === 'spinning' ? (
                                        /* Spinning letters */
                                        <Box sx={{ py: 3, minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                            <AnimatePresence mode="wait">
                                                <motion.div
                                                    key={spinLetter}
                                                    initial={{ y: -30, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    exit={{ y: 30, opacity: 0 }}
                                                    transition={{ duration: 0.06 }}
                                                >
                                                    <Typography variant="h1" sx={{
                                                        fontSize: { xs: '7rem', sm: '9rem' },
                                                        fontWeight: 900,
                                                        lineHeight: 1,
                                                        fontFamily: '"Inter", sans-serif'
                                                    }}>
                                                        {spinLetter}
                                                    </Typography>
                                                </motion.div>
                                            </AnimatePresence>
                                        </Box>
                                    ) : animationPhase === 'revealed' ? (
                                        /* Revealed letter with glow */
                                        <Box sx={{ py: 3, minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                            <motion.div
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                                            >
                                                <Typography variant="h1" sx={{
                                                    fontSize: { xs: '8rem', sm: '10rem' },
                                                    fontWeight: 900,
                                                    lineHeight: 1,
                                                    textShadow: '0 0 60px rgba(255,255,255,0.6), 0 0 120px rgba(255,255,255,0.3)',
                                                    fontFamily: '"Inter", sans-serif'
                                                }}>
                                                    {drawnLetter}
                                                </Typography>
                                            </motion.div>
                                            <motion.div
                                                initial={{ opacity: 0, y: 15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.4, duration: 0.5 }}
                                            >
                                                <Typography variant="h5" sx={{ mt: 2, fontWeight: 700 }}>
                                                    🎉 Euer nächster Buchstabe!
                                                </Typography>
                                                <Typography variant="body1" sx={{ opacity: 0.85, mt: 1 }}>
                                                    {getDisplayName(drawnProposer || '')} ist an der Reihe
                                                </Typography>
                                            </motion.div>
                                        </Box>
                                    ) : (
                                        /* Idle state: draw prompt */
                                        <Box sx={{ py: 3 }}>
                                            <CasinoIcon sx={{ fontSize: 64, mb: 2, opacity: 0.8 }} />
                                            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                                                Nächsten Buchstaben losen
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 3 }}>
                                                {26 - drawnOrder.length} von 26 Buchstaben übrig
                                            </Typography>
                                        </Box>
                                    )}

                                    {animationPhase === 'idle' && (
                                        <Stack spacing={1} alignItems="center">
                                            <Button
                                                variant="contained"
                                                size="large"
                                                startIcon={<CasinoIcon />}
                                                disabled={!canDrawNext()}
                                                onClick={handleDrawLetter}
                                                sx={{
                                                    backgroundColor: 'white !important',
                                                    backgroundImage: 'none !important',
                                                    color: '#7C4DFF !important',
                                                    fontWeight: 900,
                                                    px: 4,
                                                    borderRadius: 3,
                                                    boxShadow: '0 4px 14px 0 rgba(0,0,0,0.15)',
                                                    textTransform: 'none',
                                                    '&:hover': { backgroundColor: '#f5f5f5 !important' },
                                                    '&.Mui-disabled': {
                                                        backgroundColor: 'rgba(255,255,255,0.3) !important',
                                                        color: 'rgba(255,255,255,0.7) !important'
                                                    }
                                                }}
                                            >
                                                Jetzt losen!
                                            </Button>
                                            {!canDrawNext() && lastDrawnRound && lastDrawnRound.status !== RoundStatus.Planned && lastDrawnRound.status !== RoundStatus.Done && (
                                                <Typography variant="caption" sx={{ opacity: 0.8, mt: 1 }}>
                                                    Der Buchstabe {lastDrawnLetter} muss erst geplant werden.
                                                </Typography>
                                            )}
                                        </Stack>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* ===== RANDOM MODE: Current round card (if drawn but not done) ===== */}
            {isRandomMode && animationPhase === 'idle' && currentRound && currentRound.status !== RoundStatus.Done && (
                <Card sx={{
                    mb: 6,
                    background: needsPlanning
                        ? 'linear-gradient(135deg, #FF9800 0%, #F44336 100%)'
                        : 'linear-gradient(135deg, #7C4DFF 0%, #B47CFF 100%)',
                    color: 'white',
                    position: 'relative',
                    overflow: 'visible'
                }}>
                    <CardContent sx={{ textAlign: 'center', py: { xs: 6, sm: 8 } }}>
                        <Typography variant="overline" sx={{ opacity: 0.9, fontWeight: 700, letterSpacing: '0.1em' }}>
                            {needsPlanning ? 'Nächste Planung' : 'Nächstes Event'}
                        </Typography>

                        {needsPlanning ? (
                            <Box sx={{ position: 'relative', py: 2 }}>
                                <Typography variant="h3" sx={{ my: 2, fontWeight: 800, position: 'relative', zIndex: 1 }}>
                                    {getDisplayName(currentRound.proposerUserId)} ist dran!
                                </Typography>
                                <Typography variant="h1" sx={{ fontSize: { xs: '6rem', sm: '8rem' }, opacity: 0.15, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 0, fontWeight: 900 }}>
                                    {currentRound.letter}
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                <Typography variant="h3" sx={{ my: 2, fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.2)', fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
                                    {currentRound.proposalText}
                                </Typography>
                                {currentRound.date && (
                                    <Typography variant="h6" sx={{ opacity: 0.9, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                        <ActivityIcon /> {new Date(currentRound.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </Typography>
                                )}
                            </>
                        )}

                        {needsPlanning && targetDateInfo && (
                            <Typography variant="body2" sx={{ mt: 1, mb: 2, fontWeight: 600, bgcolor: 'rgba(255,255,255,0.2)', py: 0.5, px: 2, borderRadius: 2, display: 'inline-block' }}>
                                {targetDateInfo.text}
                            </Typography>
                        )}

                        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3, position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: 1.5 }}>
                            {needsPlanning && !isProposer ? (
                                <Button
                                    variant="contained" size="large" startIcon={<CampaignIcon />}
                                    sx={{ backgroundColor: 'white !important', backgroundImage: 'none !important', color: '#FF9800 !important', fontWeight: 900, px: { xs: 2.5, sm: 4 }, borderRadius: 3, boxShadow: '0 4px 14px 0 rgba(0,0,0,0.1)', textTransform: 'none', '&:hover': { backgroundColor: '#f5f5f5 !important' } }}
                                    onClick={() => setShowRemindDialog(true)}
                                >Person erinnern</Button>
                            ) : (
                                <Button
                                    variant="contained" size="large"
                                    sx={{ backgroundColor: 'white !important', backgroundImage: 'none !important', color: (needsPlanning ? '#d84315' : '#7C4DFF') + ' !important', fontWeight: 900, px: { xs: 2.5, sm: 4 }, borderRadius: 3, boxShadow: '0 4px 14px 0 rgba(0,0,0,0.1)', textTransform: 'none', '&:hover': { backgroundColor: '#f5f5f5 !important' } }}
                                    onClick={() => navigate(`/letter/${currentRound.letter}`)}
                                >{isPlanned ? 'Details' : (currentRound.status === RoundStatus.Draft ? 'Entwurf bearbeiten' : 'Jetzt planen')}</Button>
                            )}
                            {!needsPlanning && (
                                <Button
                                    variant="outlined" size="large" startIcon={<CheckCircleIcon />}
                                    sx={{ color: 'white', borderColor: 'white', fontWeight: 700, '&:hover': { borderColor: '#f0f0f0', bgcolor: 'rgba(255,255,255,0.1)' }, px: { xs: 2, sm: 3 } }}
                                    onClick={() => handleMarkAsDone(currentRound)}
                                    disabled={(profile?.email?.toLowerCase().trim() !== currentRound.proposerUserId?.toLowerCase().trim()) || currentRound.status !== RoundStatus.Planned}
                                >Als erledigt markieren</Button>
                            )}
                        </Stack>
                        {currentRound.status === RoundStatus.Planned && (
                            <IconButton
                                onClick={(e) => { e.stopPropagation(); setShareRound(currentRound); }}
                                sx={{ position: 'absolute', top: 12, right: 12, color: 'white', opacity: 0.8, '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.1)' } }}
                            >
                                <ShareIcon />
                            </IconButton>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ===== SEQUENTIAL MODE: Original hero card ===== */}
            {!isRandomMode && currentRound && (
                <Card sx={{
                    mb: 6,
                    background: needsPlanning
                        ? 'linear-gradient(135deg, #FF9800 0%, #F44336 100%)'
                        : 'linear-gradient(135deg, #7C4DFF 0%, #B47CFF 100%)',
                    color: 'white',
                    position: 'relative',
                    overflow: 'visible'
                }}>
                    <CardContent sx={{ textAlign: 'center', py: { xs: 6, sm: 8 } }}>
                        <Typography variant="overline" sx={{ opacity: 0.9, fontWeight: 700, letterSpacing: '0.1em' }}>
                            {needsPlanning ? 'Nächste Planung' : 'Nächstes Event'}
                        </Typography>

                        {needsPlanning ? (
                            <Box sx={{ position: 'relative', py: 2 }}>
                                <Typography variant="h3" sx={{ my: 2, fontWeight: 800, position: 'relative', zIndex: 1 }}>
                                    {getDisplayName(currentRound.proposerUserId)} ist dran!
                                </Typography>
                                <Typography variant="h1" sx={{ fontSize: { xs: '6rem', sm: '8rem' }, opacity: 0.15, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 0, fontWeight: 900 }}>
                                    {currentRound.letter}
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                <Typography variant="h3" sx={{ my: 2, fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.2)', fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
                                    {currentRound.proposalText}
                                </Typography>
                                {currentRound.date && (
                                    <Typography variant="h6" sx={{ opacity: 0.9, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                        <ActivityIcon /> {new Date(currentRound.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </Typography>
                                )}
                            </>
                        )}

                        {needsPlanning && targetDateInfo && (
                            <Typography variant="body2" sx={{ mt: 1, mb: 2, fontWeight: 600, bgcolor: 'rgba(255,255,255,0.2)', py: 0.5, px: 2, borderRadius: 2, display: 'inline-block' }}>
                                {targetDateInfo.text}
                            </Typography>
                        )}

                        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3, position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: 1.5 }}>
                            {needsPlanning && !isProposer ? (
                                <Button
                                    variant="contained" size="large" startIcon={<CampaignIcon />}
                                    sx={{ backgroundColor: 'white !important', backgroundImage: 'none !important', color: '#FF9800 !important', fontWeight: 900, px: { xs: 2.5, sm: 4 }, borderRadius: 3, boxShadow: '0 4px 14px 0 rgba(0,0,0,0.1)', textTransform: 'none', '&:hover': { backgroundColor: '#f5f5f5 !important' } }}
                                    onClick={() => setShowRemindDialog(true)}
                                >Person erinnern</Button>
                            ) : (
                                <Button
                                    variant="contained" size="large"
                                    sx={{ backgroundColor: 'white !important', backgroundImage: 'none !important', color: (needsPlanning ? '#d84315' : '#7C4DFF') + ' !important', fontWeight: 900, px: { xs: 2.5, sm: 4 }, borderRadius: 3, boxShadow: '0 4px 14px 0 rgba(0,0,0,0.1)', textTransform: 'none', '&:hover': { backgroundColor: '#f5f5f5 !important' } }}
                                    onClick={() => navigate(`/letter/${currentRound.letter}`)}
                                >{isPlanned ? 'Details' : (currentRound.status === RoundStatus.Draft ? 'Entwurf bearbeiten' : 'Jetzt planen')}</Button>
                            )}
                            {!needsPlanning && (
                                <Button
                                    variant="outlined" size="large" startIcon={<CheckCircleIcon />}
                                    sx={{ color: 'white', borderColor: 'white', fontWeight: 700, '&:hover': { borderColor: '#f0f0f0', bgcolor: 'rgba(255,255,255,0.1)' }, px: { xs: 2, sm: 3 } }}
                                    onClick={() => handleMarkAsDone(currentRound)}
                                    disabled={(profile?.email?.toLowerCase().trim() !== currentRound.proposerUserId?.toLowerCase().trim()) || currentRound.status !== RoundStatus.Planned}
                                >Als erledigt markieren</Button>
                            )}
                        </Stack>
                        {(currentRound.status === RoundStatus.Planned || currentRound.status === RoundStatus.Done) && (
                            <IconButton
                                onClick={(e) => { e.stopPropagation(); setShareRound(currentRound); }}
                                sx={{ position: 'absolute', top: 12, right: 12, color: 'white', opacity: 0.8, '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.1)' } }}
                            >
                                <ShareIcon />
                            </IconButton>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ===== TIMELINE ===== */}
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon /> Zeitstrahl
            </Typography>

            {isRandomMode && timelineRounds.length === 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <CasinoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                        <Typography variant="body1" color="text.secondary">
                            Noch kein Buchstabe gezogen. Lose deinen ersten Buchstaben!
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {timelineRounds.length > 0 && (
                <Card>
                    <List disablePadding>
                        {timelineRounds.map((round: LetterRound, index: number) => (
                            <React.Fragment key={round.letter}>
                                <ListItem disablePadding>
                                    <ListItemButton
                                        onClick={() => navigate(`/letter/${round.letter}`)}
                                        sx={{ py: 2 }}
                                    >
                                        <Box sx={{
                                            mr: 2,
                                            width: 48,
                                            height: 48,
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            bgcolor: round.status === RoundStatus.Done ? 'success.light' :
                                                round.status === RoundStatus.Planned ? 'primary.light' : 'grey.100',
                                            color: round.status === RoundStatus.Done || round.status === RoundStatus.Planned ? 'white' : 'text.secondary'
                                        }}>
                                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{round.letter}</Typography>
                                        </Box>
                                        <ListItemText
                                            primary={
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Typography variant="subtitle1" component="span" sx={{ fontWeight: 700 }}>
                                                        {getDisplayName(round.proposerUserId)}
                                                    </Typography>
                                                    <Chip
                                                        size="small"
                                                        label={getStatusLabel(round.status)}
                                                        color={getStatusColor(round.status) as any}
                                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                                    />
                                                    {round.status === RoundStatus.Done && profile && !round.ratings?.[profile.email.toLowerCase().trim()] && (
                                                        <Chip
                                                            size="small"
                                                            label="Deine Bewertung fehlt"
                                                            color="warning"
                                                            variant="outlined"
                                                            sx={{ fontSize: '0.65rem', height: 20, fontWeight: 700 }}
                                                        />
                                                    )}
                                                </Box>
                                            }
                                            secondary={
                                                <Box sx={{ mt: 0.5 }}>
                                                    <Typography variant="body1" color="text.primary" sx={{
                                                        fontWeight: 500,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        maxWidth: { xs: '200px', sm: '100%' }
                                                    }}>
                                                        {round.proposalText || ''}
                                                    </Typography>
                                                    {round.date && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                            <ActivityIcon sx={{ fontSize: 14 }} /> {new Date(round.date).toLocaleDateString('de-DE')}
                                                        </Typography>
                                                    )}
                                                    {!!round.rating && round.rating > 0 && (
                                                        <Box sx={{ display: 'flex', mt: 0.5 }}>
                                                            {[1, 2, 3, 4, 5].map((star) => {
                                                                const avg = round.rating || 0;
                                                                const isHalf = avg >= star - 0.75 && avg < star - 0.25;
                                                                const isFull = avg >= star - 0.25;
                                                                return (
                                                                    <StarIcon
                                                                        key={star}
                                                                        sx={{
                                                                            fontSize: 16,
                                                                            color: isFull || isHalf ? '#FFD700' : 'grey.300',
                                                                            opacity: isFull ? 1 : isHalf ? 0.7 : 1
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                        </Box>
                                                    )}
                                                </Box>
                                            }
                                        />
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            {(round.status === RoundStatus.Planned || round.status === RoundStatus.Done) && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => { e.stopPropagation(); setShareRound(round); }}
                                                    sx={{ color: 'action.active' }}
                                                >
                                                    <ShareIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                            {round.status === RoundStatus.Done ? <TrophyIcon color="success" /> :
                                                round.status === RoundStatus.Planned ? <PartyIcon color="primary" /> : <ChevronRightIcon color="action" />}
                                        </Stack>
                                    </ListItemButton>
                                </ListItem>
                                {index < timelineRounds.length - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </List>
                </Card>
            )}

            <Dialog open={!!ratingRound} onClose={() => setRatingRound(null)} PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: 700, textAlign: 'center' }}>Wie war das Event?</DialogTitle>
                <DialogContent sx={{ display: 'flex', justifyContent: 'center', pb: 4, pt: 1 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <IconButton
                            key={star}
                            onClick={() => submitRating(star)}
                            sx={{ color: '#FFD700', fontSize: '2.5rem' }}
                        >
                            <StarOutlineIcon fontSize="inherit" />
                        </IconButton>
                    ))}

                </DialogContent>
            </Dialog>

            {currentRound && (
                <Dialog open={showRemindDialog} onClose={() => setShowRemindDialog(false)} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
                    <DialogTitle sx={{ fontWeight: 800 }}>Partner erinnern</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Wie möchtest du {getDisplayName(currentRound.proposerUserId)} an den Buchstaben <strong>{currentRound.letter}</strong> erinnern?
                        </Typography>
                        <Stack spacing={2}>
                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<WhatsAppIcon />}
                                onClick={() => handleRemind('whatsapp')}
                                sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#128C7E' }, fontWeight: 700, borderRadius: 2 }}
                            >
                                Per WhatsApp
                            </Button>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<EmailIcon />}
                                onClick={() => handleRemind('email')}
                                sx={{ fontWeight: 700, borderRadius: 2 }}
                            >
                                Per E-Mail
                            </Button>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<CopyIcon />}
                                onClick={handleCopyLink}
                                sx={{ fontWeight: 700, borderRadius: 2 }}
                            >
                                Link kopieren
                            </Button>
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={() => setShowRemindDialog(false)} color="inherit" sx={{ fontWeight: 700 }}>Abbrechen</Button>
                    </DialogActions>
                </Dialog>
            )}

            <Snackbar open={showRemindCopySuccess} autoHideDuration={3000} onClose={() => setShowRemindCopySuccess(false)}>
                <Alert severity="success" sx={{ borderRadius: 2 }}>Link in die Zwischenablage kopiert!</Alert>
            </Snackbar>

            <SocialShareDialog
                open={!!shareRound}
                onClose={() => setShareRound(null)}
                round={shareRound}
                profile={profile}
            />
        </Container>
    );
};

export default Home;
