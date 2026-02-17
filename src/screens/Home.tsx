import React, { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Chip, List, ListItem, ListItemText, Box, Divider, ListItemButton, Button, IconButton, Stack, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { ChevronRight as ChevronRightIcon, History as HistoryIcon, Settings as SettingsIcon, EmojiEvents as TrophyIcon, Celebration as PartyIcon, LocalActivity as ActivityIcon, CheckCircle as CheckCircleIcon, Star as StarIcon, StarOutline as StarOutlineIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { storage } from '../storage';
import type { LetterRound } from '../types';
import { RoundStatus } from '../types';

const Home: React.FC = () => {
    const [rounds, setRounds] = useState<LetterRound[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        storage.getRounds().then(setRounds);
    }, []);

    const getNextRound = () => {
        if (rounds.length === 0) return null;
        // Find the FIRST round alphabetically that is not "Done"
        return rounds.find(r => r.status !== RoundStatus.Done) || rounds[rounds.length - 1];
    };

    const currentRound = getNextRound();

    const getStatusLabel = (status: RoundStatus) => {
        switch (status) {
            case RoundStatus.Done: return 'Erledigt';
            case RoundStatus.Confirmed: return 'Bestätigt';
            case RoundStatus.Proposed: return 'Vorgeschlagen';
            default: return 'Nicht gestartet';
        }
    };

    const getStatusColor = (status: RoundStatus): "success" | "primary" | "warning" | "default" => {
        switch (status) {
            case RoundStatus.Done: return 'success';
            case RoundStatus.Confirmed: return 'primary';
            case RoundStatus.Proposed: return 'warning';
            default: return 'default';
        }
    };

    const [ratingRound, setRatingRound] = useState<LetterRound | null>(null);

    const handleMarkAsDone = (round: LetterRound) => {
        setRatingRound(round);
    };

    const submitRating = async (rating: number) => {
        if (!ratingRound) return;
        const updates: Partial<LetterRound> = {
            status: RoundStatus.Done,
            rating,
            updatedAt: new Date().toISOString()
        };
        const allRounds = await storage.getRounds();
        const newRounds = allRounds.map(r => r.letter === ratingRound.letter ? { ...r, ...updates } : r);
        await storage.saveRounds(newRounds);
        setRounds(newRounds);
        setRatingRound(null);
    };

    if (rounds.length === 0 || !currentRound) return null;

    const needsPlanning = !currentRound.proposalText;

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" sx={{ color: 'primary.dark', fontWeight: 800 }}>ABC Dates</Typography>
                <Box>
                    <IconButton onClick={() => navigate('/history')}><HistoryIcon color="primary" /></IconButton>
                    <IconButton onClick={() => navigate('/settings')}><SettingsIcon color="primary" /></IconButton>
                </Box>
            </Box>

            <Card sx={{
                mb: 6,
                background: needsPlanning
                    ? 'linear-gradient(135deg, #FF9800 0%, #F44336 100%)' // Warm colors for planning
                    : 'linear-gradient(135deg, #7C4DFF 0%, #B47CFF 100%)', // Cool purple for planned
                color: 'white',
                position: 'relative',
                overflow: 'visible'
            }}>
                <CardContent sx={{ textAlign: 'center', py: 5 }}>
                    <Typography variant="overline" sx={{ opacity: 0.9, fontWeight: 700, letterSpacing: '0.1em' }}>
                        {needsPlanning ? 'Nächste Planung' : 'Nächstes Event'}
                    </Typography>

                    {needsPlanning ? (
                        <Box sx={{ position: 'relative', py: 2 }}>
                            <Typography variant="h3" sx={{ my: 2, fontWeight: 800, position: 'relative', zIndex: 1 }}>
                                {currentRound.proposerUserId === 'mauro' ? 'Mauro' : 'Giorgia'} ist dran!
                            </Typography>
                            <Typography variant="h1" sx={{ fontSize: { xs: '6rem', sm: '8rem' }, opacity: 0.15, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 0, fontWeight: 900 }}>
                                {currentRound.letter}
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <Typography variant="h3" sx={{ my: 2, fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                {currentRound.proposalText}
                            </Typography>
                            {currentRound.date && (
                                <Typography variant="h6" sx={{ opacity: 0.9, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    <ActivityIcon /> {new Date(currentRound.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </Typography>
                            )}
                        </>
                    )}

                    <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3, position: 'relative', zIndex: 1 }}>
                        <Button
                            variant="contained"
                            size="large"
                            sx={{
                                backgroundColor: 'white !important',
                                backgroundImage: 'none !important',
                                color: (needsPlanning ? '#d84315' : '#7C4DFF') + ' !important',
                                fontWeight: 900,
                                px: 4,
                                borderRadius: 3,
                                boxShadow: '0 4px 14px 0 rgba(0,0,0,0.1)',
                                textTransform: 'none',
                                '&:hover': { backgroundColor: '#f5f5f5 !important' }
                            }}
                            onClick={() => navigate(`/letter/${currentRound.letter}`)}
                        >
                            {needsPlanning ? 'Jetzt planen' : 'Details'}
                        </Button>
                        {!needsPlanning && (
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<CheckCircleIcon />}
                                sx={{ color: 'white', borderColor: 'white', fontWeight: 700, '&:hover': { borderColor: '#f0f0f0', bgcolor: 'rgba(255,255,255,0.1)' } }}
                                onClick={() => handleMarkAsDone(currentRound)}
                            >
                                Erledigt
                            </Button>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon /> Zeitstrahl
            </Typography>
            <Card>
                <List disablePadding>
                    {rounds.map((round, index) => (
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
                                            round.status === RoundStatus.Confirmed ? 'primary.light' : 'grey.100',
                                        color: round.status === RoundStatus.Done || round.status === RoundStatus.Confirmed ? 'white' : 'text.secondary'
                                    }}>
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{round.letter}</Typography>
                                    </Box>
                                    <ListItemText
                                        primary={
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Typography variant="subtitle1" component="span" sx={{ fontWeight: 700 }}>
                                                    {round.proposerUserId === 'mauro' ? 'Mauro' : 'Giorgia'}
                                                </Typography>
                                                <Chip
                                                    size="small"
                                                    label={getStatusLabel(round.status)}
                                                    color={getStatusColor(round.status) as any}
                                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                                />
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
                                                        {[...Array(5)].map((_, i) => (
                                                            <StarIcon key={i} sx={{ fontSize: 16, color: i < round.rating! ? '#FFD700' : 'grey.300' }} />
                                                        ))}
                                                    </Box>
                                                )}
                                            </Box>
                                        }
                                    />
                                    {round.status === RoundStatus.Done ? <TrophyIcon color="success" /> :
                                        round.status === RoundStatus.Confirmed ? <PartyIcon color="primary" /> : <ChevronRightIcon color="action" />}
                                </ListItemButton>
                            </ListItem>
                            {index < rounds.length - 1 && <Divider />}
                        </React.Fragment>
                    ))}
                </List>
            </Card>
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
        </Container>
    );
};

export default Home;
