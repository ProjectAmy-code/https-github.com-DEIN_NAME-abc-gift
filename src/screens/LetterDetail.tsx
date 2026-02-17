import React, { useEffect, useState, useCallback } from 'react';
import { Container, Typography, Card, CardContent, TextField, Button, Box, Chip, Stack, CircularProgress, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, Divider, IconButton, ListItemButton, DialogActions, DialogContentText } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers';
import { ArrowBack as ArrowBackIcon, AutoFixHigh as AutoFixHighIcon, Delete as DeleteIcon, Save as SaveIcon, CheckCircle as CheckCircleIcon, Star as StarIcon, StarOutline as StarOutlineIcon } from '@mui/icons-material';
import { storage } from '../storage';
import { aiService } from '../services/aiService';
import type { LetterRound } from '../types';
import { RoundStatus } from '../types';
import { parseISO } from 'date-fns';
import { debounce } from 'lodash';

const getStatusLabel = (status: RoundStatus) => {
    switch (status) {
        case RoundStatus.Done: return 'Erledigt';
        case RoundStatus.Confirmed: return 'Bestätigt';
        case RoundStatus.Proposed: return 'Vorgeschlagen';
        default: return 'Nicht gestartet';
    }
};

const LetterDetail: React.FC = () => {
    const { letter } = useParams<{ letter: string }>();
    const navigate = useNavigate();
    const [round, setRound] = useState<LetterRound | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [showAiDialog, setShowAiDialog] = useState(false);

    // Local states for instant feedback
    const [localProposal, setLocalProposal] = useState('');
    const [localNotes, setLocalNotes] = useState('');

    useEffect(() => {
        if (letter) {
            storage.getRounds().then(rounds => {
                const found = rounds.find(r => r.letter === letter);
                if (found) {
                    setRound(found);
                    setLocalProposal(found.proposalText || '');
                    setLocalNotes(found.notes || '');
                }
            });
        }
    }, [letter]);

    // Debounced storage update
    const debouncedUpdate = useCallback(
        debounce(async (letter: string, updates: Partial<LetterRound>) => {
            const allRounds = await storage.getRounds();
            const newRounds = allRounds.map(r => r.letter === letter ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
            await storage.saveRounds(newRounds);
        }, 800),
        []
    );

    const handleTextChange = (field: 'proposalText' | 'notes', value: string) => {
        if (!round || !letter) return;

        if (field === 'proposalText') {
            setLocalProposal(value);
            const status = value ? RoundStatus.Proposed : RoundStatus.NotStarted;
            setRound({ ...round, proposalText: value, status });
            debouncedUpdate(letter, { proposalText: value, status });
        } else {
            setLocalNotes(value);
            setRound({ ...round, notes: value });
            debouncedUpdate(letter, { notes: value });
        }
    };

    const updateRoundImmediate = async (updates: Partial<LetterRound>) => {
        if (!round || !letter) return;
        const allRounds = await storage.getRounds();
        const newRounds = allRounds.map(r => r.letter === letter ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
        await storage.saveRounds(newRounds);
        setRound({ ...round, ...updates });
        if (updates.proposalText !== undefined) setLocalProposal(updates.proposalText);
        if (updates.notes !== undefined) setLocalNotes(updates.notes);
    };

    const handleAiGenerate = async () => {
        if (!letter) return;
        setLoadingAI(true);
        const ideas = await aiService.generateIdeas(letter);
        setAiSuggestions(ideas);
        setLoadingAI(false);
    };

    const selectSuggestion = (text: string) => {
        updateRoundImmediate({ proposalText: text, status: RoundStatus.Proposed });
        setShowAiDialog(false);
    };

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const handleDelete = async () => {
        const cleanState: Partial<LetterRound> = {
            proposalText: '',
            date: '',
            status: RoundStatus.NotStarted,
            notes: '',
            rating: 0,
            updatedAt: new Date().toISOString()
        };

        const allRounds = await storage.getRounds();
        const newRounds = allRounds.map(r => r.letter === letter ? { ...r, ...cleanState } : r);
        await storage.saveRounds(newRounds);

        setRound(prev => prev ? { ...prev, ...cleanState } : null);
        setLocalProposal('');
        setLocalNotes('');
        setShowDeleteDialog(false);
        navigate('/');
    };

    if (!round) return null;

    const canConfirm = round.proposalText && round.date;

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
                                {round.proposerUserId === 'mauro' ? 'Mauro' : 'Giorgia'}
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
                                InputProps={{
                                    sx: { borderRadius: 3 }
                                }}
                            />
                            <Button
                                startIcon={<AutoFixHighIcon />}
                                onClick={() => setShowAiDialog(true)}
                                sx={{ mt: 1, fontWeight: 700 }}
                                color="secondary"
                            >
                                KI: Ideen generieren
                            </Button>
                        </Box>

                        <DatePicker
                            label="Datum wählen"
                            value={round.date ? parseISO(round.date) : null}
                            onChange={(newDate) => updateRoundImmediate({ date: newDate ? newDate.toISOString() : undefined })}
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
                    disabled={!canConfirm || round.status === RoundStatus.Confirmed || round.status === RoundStatus.Done}
                    onClick={() => updateRoundImmediate({ status: RoundStatus.Confirmed })}
                >
                    Vorschlag bestätigen
                </Button>
                <Button
                    variant="outlined"
                    fullWidth
                    size="large"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    disabled={round.status !== RoundStatus.Confirmed}
                    onClick={() => updateRoundImmediate({ status: RoundStatus.Done })}
                >
                    Als erledigt markieren
                </Button>

                {round.status === RoundStatus.Done && (
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>Bewertung</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <IconButton
                                        key={star}
                                        onClick={() => updateRoundImmediate({ rating: star })}
                                        sx={{ color: round.rating && round.rating >= star ? '#FFD700' : 'grey.300' }}
                                    >
                                        {round.rating && round.rating >= star ? <StarIcon /> : <StarOutlineIcon />}
                                    </IconButton>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {round.status === RoundStatus.Done && (
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

            <Dialog open={showAiDialog} onClose={() => setShowAiDialog(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 4 } }}>
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
                                        <ListItemText primary={suggestion} primaryTypographyProps={{ fontWeight: 500 }} />
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
