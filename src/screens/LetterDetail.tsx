import React, { useEffect, useState, useCallback } from 'react';
import { Container, Typography, Card, CardContent, TextField, Button, Box, Chip, Stack, CircularProgress, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, Divider, IconButton, ListItemButton, DialogActions, DialogContentText, Switch, FormControlLabel } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers';
import { ArrowBack as ArrowBackIcon, AutoFixHigh as AutoFixHighIcon, Delete as DeleteIcon, Save as SaveIcon, CheckCircle as CheckCircleIcon, Star as StarIcon, StarOutline as StarOutlineIcon, OpenInNew as OpenInNewIcon, PhotoCamera as PhotoCameraIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { storage } from '../storage';
import { aiService } from '../services/aiService';
import { useAuth } from '../context/useAuth';
import type { LetterRound, AIIdea } from '../types';
import { RoundStatus } from '../types';
import { parseISO } from 'date-fns';
import { debounce } from 'lodash';
import { resizeImage } from '../utils/imageUtils';


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
    const [aiSuggestions, setAiSuggestions] = useState<AIIdea[]>([]);
    const [showAiDialog, setShowAiDialog] = useState(false);


    // Local states for instant feedback
    const [localProposal, setLocalProposal] = useState('');
    const [localNotes, setLocalNotes] = useState('');
    const [localEvaluation, setLocalEvaluation] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);

    // Prefetching & Caching Support
    const [prefetchedIdeas, setPrefetchedIdeas] = useState<AIIdea[]>([]);
    const [isPrefetching, setIsPrefetching] = useState(false);
    const [cachedIdeasFound, setCachedIdeasFound] = useState(false);

    useEffect(() => {
        if (letter && environment?.id) {
            storage.getRounds(environment.id).then(rounds => {
                const found = rounds.find(r => r.letter === letter);
                if (found) {
                    setRound(found);
                    setLocalProposal(found.proposalText || '');
                    setLocalNotes(found.notes || '');
                    setLocalEvaluation(found.evaluationText || '');
                    checkAndPrefetch(found);
                }
            });
        }
    }, [letter, environment]);

    const checkAndPrefetch = async (currentRound: LetterRound) => {
        if (!environment || !letter) return;

        try {
            const prefs = await storage.getPreferences(environment.id, currentRound.proposerUserId);
            if (prefs && prefs.aiIdeaCache && prefs.aiIdeaCache[letter] && prefs.aiIdeaCache[letter].length > 0) {
                // Cache hit!
                setPrefetchedIdeas(prefs.aiIdeaCache[letter]);
                setCachedIdeasFound(true);
            } else {
                // Cache miss, let's prefetch in the background quietly
                if (isPrefetching) return;
                setIsPrefetching(true);
                setCachedIdeasFound(false);
                setPrefetchedIdeas([]);

                const stream = aiService.generateIdeaStream(environment.id, letter, undefined, currentRound.proposerUserId, profile?.city);
                const collected: AIIdea[] = [];
                for await (const idea of stream) {
                    collected.push(idea);
                    setPrefetchedIdeas([...collected]);
                }
                setIsPrefetching(false);

                // Save the prefetched ideas to the cache invisibly
                if (collected.length > 0 && prefs) {
                    const newPrefs = { ...prefs, aiIdeaCache: { ...(prefs.aiIdeaCache || {}), [letter]: collected } };
                    await storage.savePreferences(environment.id, newPrefs, currentRound.proposerUserId);
                }
            }
        } catch (e) {
            console.error('Quiet AI prefetch failed:', e);
            setIsPrefetching(false);
        }
    };

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

    const handleTextChange = (field: 'proposalText' | 'notes' | 'evaluationText', value: string) => {
        if (!round || !letter) return;

        if (field === 'proposalText') {
            setLocalProposal(value);
            const status = value ? RoundStatus.Draft : RoundStatus.NotStarted;
            setRound({ ...round, proposalText: value, status });
            debouncedUpdate(letter, { proposalText: value, status });
        } else if (field === 'notes') {
            setLocalNotes(value);
            setRound({ ...round, notes: value });
            debouncedUpdate(letter, { notes: value });
        } else if (field === 'evaluationText') {
            setLocalEvaluation(value);
            setRound({ ...round, evaluationText: value });
            debouncedUpdate(letter, { evaluationText: value });
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !round || !letter) return;

        setUploadingImage(true);
        try {
            const newImages: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.size > 10 * 1024 * 1024) {
                    alert(`Das Bild ${file.name} ist zu groß (max 10MB).`);
                    continue;
                }
                const base64Img = await resizeImage(file, 1024, 1024);
                newImages.push(base64Img);
            }

            if (newImages.length > 0) {
                const currentUrls = round.imageUrls || [];
                // Backup for legacy: set first image to imageUrl if empty
                const updates: Partial<LetterRound> = {
                    imageUrls: [...currentUrls, ...newImages]
                };
                if (!round.imageUrl && !currentUrls.length) {
                    updates.imageUrl = newImages[0];
                }
                updateRoundImmediate(updates);
            }
        } catch (e) {
            console.error('Error uploading images:', e);
            alert('Fehler beim Hochladen der Bilder.');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleRemoveImage = (index: number) => {
        if (!round) return;
        const currentUrls = round.imageUrls || [];
        const newUrls = currentUrls.filter((_, i) => i !== index);
        const updates: Partial<LetterRound> = { imageUrls: newUrls };

        // Update legacy imageUrl if we removed it
        if (round.imageUrl === currentUrls[index]) {
            updates.imageUrl = newUrls.length > 0 ? newUrls[0] : '';
        }

        updateRoundImmediate(updates);
    };

    const updateRoundImmediate = async (updates: Partial<LetterRound>) => {
        if (!round || !letter || !environment) return;
        const allRounds = await storage.getRounds(environment.id);
        const newRounds = allRounds.map(r => r.letter === letter ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
        await storage.saveRounds(environment.id, newRounds);
        setRound({ ...round, ...updates });
        if (updates.proposalText !== undefined) setLocalProposal(updates.proposalText);
        if (updates.notes !== undefined) setLocalNotes(updates.notes);
        if (updates.evaluationText !== undefined) setLocalEvaluation(updates.evaluationText);
    };

    const handleAiGenerate = async () => {
        if (!letter || !environment) return;


        // Instant response from Cache or running Prefetch
        if (cachedIdeasFound) {
            setAiSuggestions(prefetchedIdeas);
            return;
        }

        if (prefetchedIdeas.length > 0 && isPrefetching) {
            // It's still prefetching, show what we have so far
            setAiSuggestions([...prefetchedIdeas]);
            // Re-bind to the ongoing stream effect... in a real app this gets complex,
            // so we'll just wait for the prefetch to finish.
            setLoadingAI(true);
            // Wait for prefetching to finish (primitive wait loop for simplicity)
            const waitInterval = setInterval(() => {
                setAiSuggestions((current) => {
                    // Get latest from prefetch state via a ref or just rely on react reactivity
                    // Actually, a cleaner way is just to let the user wait a short bit or 
                    // re-run the stream. For now, let's just trigger normally if they click too early.
                    return current;
                });
            }, 500);

            // Better implementation: Just start fresh if clicked during prefetch to see streaming
            clearInterval(waitInterval);
        }

        setLoadingAI(true);
        setAiSuggestions([]); // Clear previous suggestions immediately

        try {
            const stream = aiService.generateIdeaStream(environment.id, letter, undefined, round?.proposerUserId, profile?.city, localProposal);
            const generated: AIIdea[] = [];
            for await (const idea of stream) {
                generated.push(idea);
                // Add each received idea progressively to the UI
                setAiSuggestions([...generated]);
            }

            // Re-cache whatever was generated
            const prefs = await storage.getPreferences(environment.id, round?.proposerUserId);
            if (prefs && generated.length > 0) {
                const newPrefs = { ...prefs, aiIdeaCache: { ...(prefs.aiIdeaCache || {}), [letter]: generated } };
                await storage.savePreferences(environment.id, newPrefs, round?.proposerUserId);
                setPrefetchedIdeas(generated);
                setCachedIdeasFound(true);
            }

        } catch (error) {
            console.error('Error generating AI ideas:', error);
        } finally {
            setLoadingAI(false);
        }
    };

    const [summarizing, setSummarizing] = useState(false);
    const handleSummarize = async () => {
        if (!letter) return;
        setSummarizing(true);
        const summary = await aiService.generateSummary(letter, localProposal, localNotes);
        setLocalEvaluation(summary);
        updateRoundImmediate({ evaluationText: summary });
        setSummarizing(false);
    };

    const selectSuggestion = (suggestion: AIIdea) => {
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
                                error={!localProposal && !isDone && round.status !== RoundStatus.NotStarted}
                                helperText={(!localProposal && !isDone && round.status !== RoundStatus.NotStarted) ? "Bitte gib eine Aktivität an" : ""}
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
                                    error: !round.date && !isDone && round.status !== RoundStatus.NotStarted,
                                    helperText: (!round.date && !isDone && round.status !== RoundStatus.NotStarted) ? "Bitte wähle ein Datum" : "",
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
                    onClick={async () => {
                        await updateRoundImmediate({ status: RoundStatus.Planned });
                        navigate('/');
                    }}
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

                {round.status === RoundStatus.Done && (
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, mb: 2, display: 'block' }}>
                                Unsere Erinnerung
                            </Typography>

                            <Stack spacing={3}>
                                <Box>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={4}
                                        label="Erinnerung / Bewertung"
                                        placeholder="Wie war's? Schreibt eine kleine Erinnerung..."
                                        value={localEvaluation}
                                        onChange={(e) => handleTextChange('evaluationText', e.target.value)}
                                        disabled={!isProposer}
                                        InputProps={{ sx: { borderRadius: 3 } }}
                                    />
                                    <Button
                                        startIcon={summarizing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                                        onClick={handleSummarize}
                                        disabled={!isProposer || summarizing || (!localProposal && !localNotes)}
                                        sx={{ mt: 1, fontWeight: 700 }}
                                        color="secondary"
                                    >
                                        KI: Zusammenfassen
                                    </Button>
                                </Box>

                                <Box>
                                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                                        Fotos hinzufügen
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <Button
                                            component="label"
                                            variant="outlined"
                                            startIcon={uploadingImage ? <CircularProgress size={16} /> : <PhotoCameraIcon />}
                                            disabled={!isProposer || uploadingImage}
                                            sx={{ borderRadius: 2, alignSelf: 'flex-start' }}
                                        >
                                            {(round.imageUrls?.length || 0) > 0 ? "Weitere Bilder wählen" : "Bilder hochladen"}
                                            <input type="file" hidden accept="image/*" multiple onChange={handleImageUpload} />
                                        </Button>

                                        {/* Grid of miniatures */}
                                        {(round.imageUrls?.length || 0) > 0 && (
                                            <Box sx={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                                gap: 1.5,
                                                mt: 1
                                            }}>
                                                {round.imageUrls?.map((url, idx) => (
                                                    <Box key={idx} sx={{ position: 'relative', pt: '100%' }}>
                                                        <Box sx={{
                                                            position: 'absolute',
                                                            top: 0, left: 0, right: 0, bottom: 0,
                                                            borderRadius: 2,
                                                            overflow: 'hidden',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                            bgcolor: 'grey.100'
                                                        }}>
                                                            <img
                                                                src={url}
                                                                alt={`Date image ${idx}`}
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            />
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleRemoveImage(idx)}
                                                                sx={{
                                                                    position: 'absolute',
                                                                    top: 2, right: 2,
                                                                    bgcolor: 'rgba(255,255,255,0.8)',
                                                                    '&:hover': { bgcolor: 'white' }
                                                                }}
                                                                disabled={!isProposer}
                                                            >
                                                                <DeleteIcon fontSize="small" color="error" />
                                                            </IconButton>
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Box>
                                        )}

                                        {/* Legacy support preview if imageUrls is empty but imageUrl exists */}
                                        {!(round.imageUrls?.length) && round.imageUrl && (
                                            <Box sx={{ mt: 1, width: '100%', maxWidth: 300, borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', position: 'relative' }}>
                                                <img src={round.imageUrl} alt="Date Erinnerung" style={{ width: '100%', display: 'block' }} />
                                                <IconButton
                                                    size="small"
                                                    onClick={() => updateRoundImmediate({ imageUrl: '' })}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: 8, right: 8,
                                                        bgcolor: 'rgba(255,255,255,0.8)',
                                                        '&:hover': { bgcolor: 'white' }
                                                    }}
                                                    disabled={!isProposer}
                                                >
                                                    <DeleteIcon fontSize="small" color="error" />
                                                </IconButton>
                                            </Box>
                                        )}
                                    </Box>
                                </Box>

                                <Divider />

                                <Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={!!round.publishReview}
                                                onChange={(e) => updateRoundImmediate({ publishReview: e.target.checked })}
                                                disabled={!isProposer}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>In den Charts veröffentlichen</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Andere Nutzer können diesen Eintrag (Text & Bild) in der Rangliste sehen.
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </Box>
                            </Stack>
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
                                <ListItem disablePadding key={idx} sx={{ display: 'block', mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                                    <ListItemButton onClick={() => selectSuggestion(suggestion)} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <Box display="flex" justifyContent="space-between" width="100%" alignItems="flex-start">
                                            <ListItemText
                                                primary={suggestion.title}
                                                secondary={suggestion.description}
                                                primaryTypographyProps={{ fontWeight: 700 }}
                                                secondaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                                                sx={{ m: 0, pr: 2 }}
                                            />
                                            {suggestion.getYourGuidePrice && (
                                                <Chip label={suggestion.getYourGuidePrice} size="small" variant="outlined" color="primary" sx={{ fontWeight: 600, height: 24, fontSize: '0.75rem', mt: 0.5 }} />
                                            )}
                                        </Box>
                                        {suggestion.matchedPreferences && suggestion.matchedPreferences.length > 0 && (
                                            <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                                                {suggestion.matchedPreferences.map((pref, i) => (
                                                    <Chip key={i} label={pref} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                                                ))}
                                            </Box>
                                        )}
                                    </ListItemButton>
                                    {suggestion.getYourGuideSearch && (
                                        <Box sx={{ p: 1, pt: 0, bgcolor: 'action.hover', borderTop: '1px solid', borderColor: 'divider' }}>
                                            {suggestion.getYourGuideCount && (
                                                <Typography variant="caption" sx={{ display: 'block', mb: 1, ml: 1, mt: 1, color: 'text.secondary', fontWeight: 600 }}>
                                                    {suggestion.getYourGuideCount} {suggestion.getYourGuideCount === 1 ? 'Vorschlag' : 'Vorschläge'} auf GetYourGuide
                                                </Typography>
                                            )}
                                            <Button
                                                fullWidth
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                                endIcon={<OpenInNewIcon fontSize="small" />}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(`https://www.getyourguide.de/s?q=${encodeURIComponent(suggestion.getYourGuideSearch!)}&partner_id=E2CXO4F`, '_blank');
                                                }}
                                                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                                            >
                                                Auf GetYourGuide suchen
                                            </Button>
                                        </Box>
                                    )}
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
