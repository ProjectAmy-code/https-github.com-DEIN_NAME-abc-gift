import React, { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, TextField, Button, Box, Chip, Stack, CircularProgress, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, Divider, IconButton, ListItemButton } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers';
import { ArrowBack as ArrowBackIcon, AutoFixHigh as AutoFixHighIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { storage } from '../storage';
import { aiMock } from '../services/aiMock';
import type { LetterRound } from '../types';
import { RoundStatus } from '../types';
import { parseISO } from 'date-fns';

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

    useEffect(() => {
        if (letter) {
            storage.getRounds().then(rounds => {
                const found = rounds.find(r => r.letter === letter);
                if (found) setRound(found);
            });
        }
    }, [letter]);

    const updateRound = async (updates: Partial<LetterRound>) => {
        if (!round) return;
        const allRounds = await storage.getRounds();
        const newRounds = allRounds.map(r => r.letter === round.letter ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
        await storage.saveRounds(newRounds);
        setRound({ ...round, ...updates });
    };

    const handleAiGenerate = async () => {
        if (!letter) return;
        setLoadingAI(true);
        const ideas = await aiMock.generateIdeas(letter);
        setAiSuggestions(ideas);
        setLoadingAI(false);
    };

    const selectSuggestion = (text: string) => {
        updateRound({ proposalText: text, status: RoundStatus.Proposed });
        setShowAiDialog(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Möchtest du diesen Eintrag wirklich löschen?')) {
            await updateRound({ proposalText: '', date: undefined, status: RoundStatus.NotStarted, notes: '' });
            navigate('/');
        }
    };

    if (!round) return null;

    const canConfirm = round.proposalText && round.date;

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                <Typography variant="h4" sx={{ fontWeight: 500 }}>Buchstabe {round.letter}</Typography>
            </Box>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">Status</Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                                <Chip label={getStatusLabel(round.status)} color={round.status === RoundStatus.Done ? 'success' : 'primary'} />
                            </Box>
                        </Box>
                        <Box textAlign="right">
                            <Typography variant="overline" color="text.secondary">An der Reihe</Typography>
                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{round.proposerUserId === 'mauro' ? 'Mauro' : 'Giorgia'}</Typography>
                        </Box>
                    </Box>

                    <Stack spacing={3} sx={{ mt: 3 }}>
                        <Box>
                            <TextField
                                fullWidth
                                label="Aktivitätsvorschlag"
                                placeholder="Z.B.: Wellness-Nachmittag"
                                value={round.proposalText || ''}
                                onChange={(e) => updateRound({ proposalText: e.target.value, status: e.target.value ? RoundStatus.Proposed : RoundStatus.NotStarted })}
                                variant="outlined"
                            />
                            <Button
                                startIcon={<AutoFixHighIcon />}
                                onClick={() => setShowAiDialog(true)}
                                sx={{ mt: 1 }}
                            >
                                KI: Ideen generieren
                            </Button>
                        </Box>

                        <DatePicker
                            label="Datum wählen"
                            value={round.date ? parseISO(round.date) : null}
                            onChange={(newDate) => updateRound({ date: newDate ? newDate.toISOString() : undefined })}
                            slotProps={{ textField: { fullWidth: true, required: true } }}
                        />

                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Notizen (Optional)"
                            value={round.notes || ''}
                            onChange={(e) => updateRound({ notes: e.target.value })}
                        />
                    </Stack>
                </CardContent>
            </Card>

            <Stack spacing={2}>
                <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={!canConfirm || round.status === RoundStatus.Confirmed || round.status === RoundStatus.Done}
                    onClick={() => updateRound({ status: RoundStatus.Confirmed })}
                >
                    Als final bestätigen
                </Button>
                <Button
                    variant="outlined"
                    fullWidth
                    size="large"
                    color="success"
                    disabled={round.status !== RoundStatus.Confirmed}
                    onClick={() => updateRound({ status: RoundStatus.Done })}
                >
                    Als erledigt markieren
                </Button>

                {round.status === RoundStatus.Done && (
                    <Button color="error" startIcon={<DeleteIcon />} onClick={handleDelete}>
                        Eintrag löschen
                    </Button>
                )}
            </Stack>

            <Dialog open={showAiDialog} onClose={() => setShowAiDialog(false)} fullWidth maxWidth="xs">
                <DialogTitle>KI Aktivitäts-Assistent</DialogTitle>
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
                                    <ListItemButton onClick={() => selectSuggestion(suggestion)} >
                                        <ListItemText primary={suggestion} />
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
