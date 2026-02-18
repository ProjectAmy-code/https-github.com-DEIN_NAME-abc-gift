import React, { useEffect, useState, useCallback } from 'react';
import { Container, Typography, Card, CardContent, TextField, Button, Box, Chip, Stack, CircularProgress, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, Divider, IconButton, ListItemButton, DialogActions, DialogContentText } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers';
import { ArrowBack as ArrowBackIcon, AutoFixHigh as AutoFixHighIcon, Delete as DeleteIcon, Save as SaveIcon, CheckCircle as CheckCircleIcon, Star as StarIcon, StarOutline as StarOutlineIcon } from '@mui/icons-material';
import { storage } from '../storage';
import { aiService } from '../services/aiService';
import { useAuth } from '../context/useAuth';
import type { LetterRound } from '../types';
import { RoundStatus } from '../types';
import { parseISO } from 'date-fns';
import { debounce } from 'lodash';

const getStatusLabel = (status: RoundStatus) => {
    switch (status) {
        case RoundStatus.Done: return 'Erledigt';
        case RoundStatus.Planned: return 'Geplant';
        case RoundStatus.Draft: return 'Entwurf';
        default: return 'Nicht gestartet';
    }
};

const LetterDetail: React.FC = () => {
    const { letter } = useParams<{ letter: string }>();
    const navigate = useNavigate();
    const { profile, environment, loading: authLoading } = useAuth();
    const [round, setRound] = useState<LetterRound | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<{ title: string; description: string }[]>([]);
    const [showAiDialog, setShowAiDialog] = useState(false);

    // Local states for instant feedback
    const [localProposal, setLocalProposal] = useState('');
    const [localNotes, setLocalNotes] = useState('');

    useEffect(() => {
        if (letter && environment?.id) {
            storage.getRounds(environment.id).then(rounds => {
                const found = rounds.find(r => r.letter === letter);
                if (found) {
                    setRound(found);
                    setLocalProposal(found.proposalText || '');
                    setLocalNotes(found.notes || '');
                }
            });
        }
    }, [letter, environment]);

    const getDisplayName = (email: string) => {
        if (!environment) return email;
        const normalizedEmail = email.toLowerCase().replace(/\./g, '_');
        return environment.memberNames[normalizedEmail] || email;
    };

    // Debounced storage update
    const debouncedUpdate = useCallback(
        debounce(async (letter: string, updates: Partial<LetterRound>) => {
            if (!environment) return;
            const allRounds = await storage.getRounds(environment.id);
            const newRounds = allRounds.map(r => r.letter === letter ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
            await storage.saveRounds(environment.id, newRounds);
        }, 800),
        [environment]
    );

    const handleTextChange = (field: 'proposalText' | 'notes', value: string) => {
        if (!round || !letter) return;

        if (field === 'proposalText') {
            setLocalProposal(value);
            const status = value ? RoundStatus.Draft : RoundStatus.NotStarted;
            setRound({ ...round, proposalText: value, status });
            debouncedUpdate(letter, { proposalText: value, status });
        } else {
            setLocalNotes(value);
            setRound({ ...round, notes: value });
            debouncedUpdate(letter, { notes: value });
        }
    };

    const updateRoundImmediate = async (updates: Partial<LetterRound>) => {
        if (!round || !letter || !environment) return;
        const allRounds = await storage.getRounds(environment.id);
        const newRounds = allRounds.map(r => r.letter === letter ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
        await storage.saveRounds(environment.id, newRounds);
        setRound({ ...round, ...updates });
        if (updates.proposalText !== undefined) setLocalProposal(updates.proposalText);
        if (updates.notes !== undefined) setLocalNotes(updates.notes);
    };

    const handleAiGenerate = async () => {
        if (!letter || !environment) return;
        setLoadingAI(true);
        const ideas = await aiService.generateIdeas(environment.id, letter);
        setAiSuggestions(ideas);
        setLoadingAI(false);
    };

    const selectSuggestion = (suggestion: { title: string; description: string }) => {
        updateRoundImmediate({
            proposalText: suggestion.title,
            notes: suggestion.description ? `${localNotes}\n\n${suggestion.description}`.trim() : localNotes,
            status: RoundStatus.Draft
        });
        setShowAiDialog(false);
    };

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const handleDelete = async () => {
        if (!environment || !letter) return;
        const cleanState: Partial<LetterRound> = {
            proposalText: '',
            date: '',
            status: RoundStatus.NotStarted,
            notes: '',
            rating: 0,
            updatedAt: new Date().toISOString()
        };

        const allRounds = await storage.getRounds(environment.id);
        const newRounds = allRounds.map(r => r.letter === letter ? { ...r, ...cleanState } : r);
        await storage.saveRounds(environment.id, newRounds);

        setRound(prev => prev ? { ...prev, ...cleanState } : null);
        setLocalProposal('');
        setLocalNotes('');
        setShowDeleteDialog(false);
        navigate('/');
    };

    if (authLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!round || !environment) return null;

    const isAdmin = profile?.email?.toLowerCase().trim() === environment.adminEmail?.toLowerCase().trim();
    const isProposer = profile?.email?.toLowerCase().trim() === round.proposerUserId?.toLowerCase().trim();
    const isDone = round.status === RoundStatus.Done;

    const canConfirm = round.proposalText && round.date;
    const canEdit = isProposer && !isDone;
    const canDelete = isDone ? isAdmin : isProposer;

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 2, sm: 4 } }}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'background.paper', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" sx={{ color: 'primary.dark' }}>Buchstabe {round.letter}</Typography>
            </Box>

            <Card sx={{ mb: 3, overflow: 'visible' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                        <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>Status</Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                                <Chip
                                    label={getStatusLabel(round.status)}
                                    color={round.status === RoundStatus.Done ? 'success' : 'primary'}
                                    variant={round.status === RoundStatus.NotStarted ? 'outlined' : 'filled'}
                                />
                            </Box>
                        </Box>
                        <Box textAlign="right">
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>An der Reihe</Typography>
                            <Typography variant="subtitle1" sx={{ color: 'primary.main' }}>
                                {getDisplayName(round.proposerUserId)}
                            </Typography>
                        </Box>
                    </Box>

                    <Stack spacing={3}>
                        <Box>
                            <TextField
                                fullWidth
                                label="Aktivitätsvorschlag"
                                placeholder="Z.B.: Wellness-Nachmittag"
                                value={localProposal}
                                onChange={(e) => handleTextChange('proposalText', e.target.value)}
                                variant="outlined"
                                disabled={!canEdit}
                                InputProps={{
                                    sx: { borderRadius: 3 }
                                }}
                            />
                            <Button
                                startIcon={<AutoFixHighIcon />}
                                onClick={() => setShowAiDialog(true)}
                                sx={{ mt: 1, fontWeight: 700 }}
                                color="secondary"
                                disabled={!canEdit}
                            >
                                KI: Ideen generieren
                            </Button>
                        </Box>

                        <DatePicker
                            label="Datum wählen"
                            value={round.date ? parseISO(round.date) : null}
                            onChange={(newDate) => updateRoundImmediate({ date: newDate ? newDate.toISOString() : undefined })}
                            disabled={!canEdit}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    required: true,
                                    InputProps: { sx: { borderRadius: 3 } }
                                }
                            }}
                        />

                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Notizen (Optional)"
                            value={localNotes}
                            onChange={(e) => handleTextChange('notes', e.target.value)}
                            disabled={!canEdit}
                            InputProps={{
                                sx: { borderRadius: 3 }
                            }}
                        />
                    </Stack>
                </CardContent>
            </Card>

            <Stack spacing={2}>
                <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    startIcon={<SaveIcon />}
                    disabled={!canEdit || !canConfirm || round.status === RoundStatus.Planned}
                    onClick={() => updateRoundImmediate({ status: RoundStatus.Planned })}
                >
                    Planung abschließen
                </Button>
                <Button
                    variant="outlined"
                    fullWidth
                    size="large"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    disabled={round.status !== RoundStatus.Planned || (profile?.email?.toLowerCase().trim() !== round.proposerUserId?.toLowerCase().trim())}
                    onClick={() => updateRoundImmediate({ status: RoundStatus.Done })}
                >
                    Als erledigt markieren
                </Button>

                {round.status === RoundStatus.Done && (
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>Bewertungen</Typography>
                                {round.status === RoundStatus.Done && profile && !round.ratings?.[profile.email.toLowerCase().trim()] && (
                                    <Chip
                                        label="Bitte bewerten!"
                                        color="warning"
                                        size="small"
                                        sx={{
                                            fontWeight: 800,
                                            height: 20,
                                            fontSize: '0.65rem',
                                            animation: 'pulse 2s infinite',
                                            '@keyframes pulse': {
                                                '0%': { transform: 'scale(1)', opacity: 1 },
                                                '50%': { transform: 'scale(1.05)', opacity: 0.8 },
                                                '100%': { transform: 'scale(1)', opacity: 1 },
                                            },
                                        }}
                                    />
                                )}
                            </Box>

                            {/* Average Rating Display */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, mb: 3 }}>
                                <Box sx={{ display: 'flex' }}>
                                    {[1, 2, 3, 4, 5].map((star) => {
                                        const avg = round.rating || 0;
                                        const isHalf = avg >= star - 0.75 && avg < star - 0.25;
                                        const isFull = avg >= star - 0.25;
                                        return (
                                            <StarIcon
                                                key={star}
                                                sx={{
                                                    color: isFull ? '#FFD700' : isHalf ? '#FFD700' : 'grey.300',
                                                    opacity: isFull ? 1 : isHalf ? 0.7 : 1
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    {round.rating ? round.rating.toFixed(1) : '0.0'}
                                </Typography>
                            </Box>

                            <Divider sx={{ mb: 2 }} />

                            {/* Individual Ratings List */}
                            <Typography variant="subtitle2" gutterBottom>Mitglieder Bewertungen</Typography>
                            <List disablePadding>
                                {environment.memberEmails.map((email: string) => {
                                    const rating = round.ratings?.[email.toLowerCase().trim()];
                                    const isMe = email.toLowerCase().trim() === profile?.email?.toLowerCase().trim();
                                    return (
                                        <ListItem
                                            key={email}
                                            disableGutters
                                            sx={{
                                                py: 1,
                                                px: isMe ? 1.5 : 0,
                                                borderRadius: 2,
                                                ...(isMe && {
                                                    bgcolor: 'action.hover',
                                                    border: rating ? '1px solid transparent' : '1px solid #ffd70044',
                                                    mb: 0.5,
                                                    transition: 'all 0.2s ease-in-out'
                                                })
                                            }}
                                        >
                                            <ListItemText
                                                primary={getDisplayName(email)}
                                                secondary={isMe ? "(Deine Bewertung)" : undefined}
                                                primaryTypographyProps={{ variant: 'body2', fontWeight: isMe ? 700 : 500 }}
                                                secondaryTypographyProps={{ variant: 'caption', sx: { color: isMe ? 'primary.main' : 'text.secondary' } }}
                                            />
                                            <Box sx={{ display: 'flex' }}>
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <IconButton
                                                        key={star}
                                                        size={isMe ? "medium" : "small"}
                                                        disabled={!isMe}
                                                        onClick={() => {
                                                            const currentRatings: Record<string, number> = round.ratings || {};
                                                            const newRatings: Record<string, number> = {
                                                                ...currentRatings,
                                                                [email.toLowerCase().trim()]: star
                                                            };
                                                            const allRatings = Object.values(newRatings);
                                                            const newAvg = allRatings.reduce((acc: number, val: number) => acc + val, 0) / allRatings.length;
                                                            updateRoundImmediate({
                                                                ratings: newRatings,
                                                                rating: newAvg
                                                            });
                                                        }}
                                                        sx={{
                                                            p: isMe ? 0.5 : 0.2,
                                                            color: rating && rating >= star ? '#FFD700' : 'grey.300',
                                                            '&:hover': isMe ? {
                                                                color: '#FFD700',
                                                                transform: 'scale(1.2)'
                                                            } : {}
                                                        }}
                                                    >
                                                        {rating && rating >= star ? (
                                                            <StarIcon fontSize={isMe ? "medium" : "small"} />
                                                        ) : (
                                                            <StarOutlineIcon fontSize={isMe ? "medium" : "small"} />
                                                        )}
                                                    </IconButton>
                                                ))}
                                            </Box>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </CardContent>
                    </Card>
                )}

                {canDelete && (
                    <Button color="error" startIcon={<DeleteIcon />} onClick={() => setShowDeleteDialog(true)} sx={{ mt: 1 }}>
                        Eintrag löschen
                    </Button>
                )}
            </Stack>

            <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>Eintrag löschen?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Bist du sicher, dass du diesen Eintrag löschen möchtest? Alle Daten (Vorschlag, Datum, Bewertung) gehen verloren.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setShowDeleteDialog(false)} color="inherit" sx={{ fontWeight: 700 }}>Abbrechen</Button>
                    <Button onClick={handleDelete} color="error" variant="contained" sx={{ fontWeight: 700, borderRadius: 2 }}>Löschen</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={showAiDialog} onClose={() => setShowAiDialog(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>KI Aktivitäts-Assistent</DialogTitle>
                <DialogContent>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleAiGenerate}
                        disabled={loadingAI}
                        sx={{ mt: 2, mb: aiSuggestions.length > 0 ? 1 : 2 }}
                    >
                        {loadingAI ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : aiSuggestions.length > 0 ? (
                            'Andere Vorschläge generieren'
                        ) : (
                            'Vorschläge generieren'
                        )}
                    </Button>

                    {aiSuggestions.length > 0 && (
                        <List>
                            <Divider sx={{ mb: 1 }} />
                            {aiSuggestions.map((suggestion, idx) => (
                                <ListItem disablePadding key={idx}>
                                    <ListItemButton onClick={() => selectSuggestion(suggestion)} sx={{ borderRadius: 2 }}>
                                        <ListItemText
                                            primary={suggestion.title}
                                            secondary={suggestion.description}
                                            primaryTypographyProps={{ fontWeight: 600 }}
                                            secondaryTypographyProps={{ variant: 'caption' }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </DialogContent>
            </Dialog>
        </Container>
    );
};

export default LetterDetail;
