import React, { useState, useEffect } from 'react';
import {
    Container, Box, Typography, TextField, Button, CircularProgress, Stack,
    Stepper, Step, StepLabel, Slider, Chip, Switch, FormControlLabel,
    ToggleButton, ToggleButtonGroup, List, ListItem, ListItemText,
    ListItemIcon
} from '@mui/material';
import {
    LocationOn as LocationIcon,
    Euro as BudgetIcon,
    AccessTime as TimeIcon,
    Favorite as StyleIcon,
    Block as NoGoIcon,
    AutoAwesome as AIPreviewIcon,
    CheckCircle as CheckIcon,
    WbSunny as OutdoorIcon,
    MeetingRoom as IndoorIcon,
    CompareArrows as MixIcon,
    DirectionsCar as CarIcon,
    ChildCare as KidsIcon,
    CloudQueue as RainIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { storage } from '../storage';
import { aiService } from '../services/aiService';
import type { UserPreferences } from '../types';

const STEPS = ['Basics', 'Budget & Zeit', 'Stil & Rahmen', 'No-Gos & Start'];

const STYLES = ['Entspannung', 'Essen & Trinken', 'Kultur', 'Natur', 'Sport', 'Kreativ', 'Abenteuer', 'Nur Zuhause'];
const NO_GOS = ['Kino', 'Restaurant', 'Wandern', 'Bars/Alkohol', 'Menschenmengen', 'Lautstärke', 'Teuer', 'Lange Fahrtzeit', 'Sportlich'];

const Onboarding: React.FC = () => {
    const { profile, environment, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [generatingPreview, setGeneratingPreview] = useState(false);
    const [previewIdeas, setPreviewIdeas] = useState<any[]>([]);

    const [prefs, setPrefs] = useState<UserPreferences>({
        radiusKm: 25,
        planningDays: 'both',
        language: 'de',
        budgetTier: 'medium',
        durationTier: '60-120',
        timeOfDay: 'evening',
        styles: [],
        indoorOutdoor: 'mix',
        rainRulePreferIndoor: true,
        carAvailable: false,
        kidsIncluded: false,
        noGos: [],
        notes: ''
    });

    useEffect(() => {
        if (!authLoading && !environment) {
            navigate('/login');
        } else if (environment) {
            // Load existing preferences if available
            storage.getPreferences(environment.id, profile?.email).then(existingPrefs => {
                if (existingPrefs) {
                    setPrefs(prev => ({ ...prev, ...existingPrefs }));
                }
            });
        }
    }, [environment, authLoading, navigate]);

    const handleNext = () => {
        if (activeStep === STEPS.length - 1) {
            handleComplete();
        } else {
            setActiveStep((prev: number) => prev + 1);
            if (activeStep === 2) {
                generatePreview();
            }
        }
    };

    const handleBack = () => setActiveStep((prev: number) => prev - 1);

    const handleComplete = async () => {
        if (!environment) return;
        setLoading(true);
        try {
            const completedPrefs = {
                ...prefs,
                completedAt: new Date().toISOString()
            };
            await storage.savePreferences(environment.id, completedPrefs, profile?.email);
            navigate('/');
        } catch (err) {
            console.error('Error saving preferences:', err);
        } finally {
            setLoading(false);
        }
    };

    const generatePreview = async () => {
        if (!environment) return;
        setGeneratingPreview(true);
        try {
            // Reale KI-Ideen generieren (Buchstabe A für die Vorschau)
            const ideas = await aiService.generateIdeas(environment.id, 'A', prefs, profile?.email);
            setPreviewIdeas(ideas);
        } catch (err) {
            console.error('Error generating AI preview:', err);
            // Fallback mock if error
            setPreviewIdeas(['Abendessen am See', 'Ausstellung besuchen', 'Abenteuer-Golf']);
        } finally {
            setGeneratingPreview(false);
        }
    };

    const toggleStyle = (style: string) => {
        setPrefs((prev: UserPreferences) => ({
            ...prev,
            styles: prev.styles.includes(style)
                ? prev.styles.filter((s: string) => s !== style)
                : [...prev.styles, style]
        }));
    };

    const toggleNoGo = (noGo: string) => {
        setPrefs((prev: UserPreferences) => ({
            ...prev,
            noGos: prev.noGos.includes(noGo)
                ? prev.noGos.filter((n: string) => n !== noGo)
                : [...prev.noGos, noGo]
        }));
    };

    if (authLoading || !environment) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 4, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.dark', mb: 1 }}>Setup</Typography>
                <Typography variant="body2" color="text.secondary">Personalisiere deine ABC Date Reise</Typography>
            </Box>

            <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
                {STEPS.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            <Box sx={{ py: 1, mb: 4, flexGrow: 1 }}>
                {activeStep === 0 && (
                    <Stack spacing={4}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocationIcon fontSize="small" color="primary" /> Standort & Reichweite
                            </Typography>
                            <TextField
                                fullWidth
                                label="Deine Stadt"
                                variant="outlined"
                                value={prefs.city || ''}
                                onChange={(e) => setPrefs({ ...prefs, city: e.target.value })}
                                placeholder="z.B. Berlin"
                                sx={{ mb: 2 }}
                            />
                            <Typography variant="caption" color="text.secondary">Radius: {prefs.radiusKm} km</Typography>
                            <Slider
                                value={prefs.radiusKm}
                                min={5}
                                max={50}
                                step={5}
                                onChange={(_, v) => setPrefs({ ...prefs, radiusKm: v as number })}
                                valueLabelDisplay="auto"
                            />
                        </Box>

                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Wann plant ihr meistens?</Typography>
                            <ToggleButtonGroup
                                fullWidth
                                value={prefs.planningDays}
                                exclusive
                                onChange={(_, v) => v && setPrefs({ ...prefs, planningDays: v })}
                                color="primary"
                            >
                                <ToggleButton value="weekday">Wochentags</ToggleButton>
                                <ToggleButton value="weekend">Wochenende</ToggleButton>
                                <ToggleButton value="both">Beides</ToggleButton>
                                <ToggleButton value="none">Keine</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Sprache der Vorschläge</Typography>
                            <ToggleButtonGroup
                                fullWidth
                                value={prefs.language}
                                exclusive
                                onChange={(_, v) => v && setPrefs({ ...prefs, language: v })}
                                color="primary"
                            >
                                <ToggleButton value="de">Deutsch</ToggleButton>
                                <ToggleButton value="en">English</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Stack>
                )}

                {activeStep === 1 && (activeStep === 1) && (
                    <Stack spacing={4}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <BudgetIcon fontSize="small" color="primary" /> Budget-Rahmen
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                {['low', 'medium', 'high', 'none'].map(b => (
                                    <Chip
                                        key={b}
                                        label={b === 'low' ? 'Günstig' : b === 'medium' ? 'Mittel' : b === 'high' ? 'Gehoben' : 'Keine'}
                                        onClick={() => setPrefs({ ...prefs, budgetTier: b as any })}
                                        color={prefs.budgetTier === b ? 'primary' : 'default'}
                                        variant={prefs.budgetTier === b ? 'filled' : 'outlined'}
                                        sx={{ flexGrow: 1, py: 2.5 }}
                                    />
                                ))}
                            </Stack>
                        </Box>

                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TimeIcon fontSize="small" color="primary" /> Typische Dauer
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {[
                                    { v: '30-60', l: '30-60 Min' },
                                    { v: '60-120', l: '1-2 Std' },
                                    { v: '2-4h', l: '2-4 Std' },
                                    { v: 'half-day', l: 'Halber Tag' },
                                    { v: 'full-day', l: 'Ganzer Tag' },
                                    { v: 'none', l: 'Keine' }
                                ].map(d => (
                                    <Chip
                                        key={d.v}
                                        label={d.l}
                                        onClick={() => setPrefs({ ...prefs, durationTier: d.v as any })}
                                        color={prefs.durationTier === d.v ? 'secondary' : 'default'}
                                        variant={prefs.durationTier === d.v ? 'filled' : 'outlined'}
                                    />
                                ))}
                            </Box>
                        </Box>

                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Tageszeit</Typography>
                            <ToggleButtonGroup
                                fullWidth
                                value={prefs.timeOfDay}
                                exclusive
                                onChange={(_, v) => v && setPrefs({ ...prefs, timeOfDay: v })}
                                color="primary"
                            >
                                <ToggleButton value="morning">Morgens</ToggleButton>
                                <ToggleButton value="afternoon">Mittags</ToggleButton>
                                <ToggleButton value="evening">Abends</ToggleButton>
                                <ToggleButton value="none">Keine</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Stack>
                )}

                {activeStep === 2 && (
                    <Stack spacing={4}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <StyleIcon fontSize="small" color="primary" /> Aktivitäts-Stil
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {STYLES.map(s => (
                                    <Chip
                                        key={s}
                                        label={s}
                                        onClick={() => toggleStyle(s)}
                                        color={prefs.styles.includes(s) ? 'primary' : 'default'}
                                        variant={prefs.styles.includes(s) ? 'filled' : 'outlined'}
                                    />
                                ))}
                            </Box>
                        </Box>

                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Indoor / Outdoor</Typography>
                            <ToggleButtonGroup
                                fullWidth
                                value={prefs.indoorOutdoor}
                                exclusive
                                onChange={(_, v) => v && setPrefs({ ...prefs, indoorOutdoor: v })}
                                color="primary"
                            >
                                <ToggleButton value="indoor" sx={{ gap: 1 }}><IndoorIcon fontSize="small" /> Indoor</ToggleButton>
                                <ToggleButton value="outdoor" sx={{ gap: 1 }}><OutdoorIcon fontSize="small" /> Outdoor</ToggleButton>
                                <ToggleButton value="mix" sx={{ gap: 1 }}><MixIcon fontSize="small" /> Mix</ToggleButton>
                                <ToggleButton value="none">Keine</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        <Stack spacing={2}>
                            <FormControlLabel
                                control={<Switch checked={prefs.rainRulePreferIndoor} onChange={(e) => setPrefs({ ...prefs, rainRulePreferIndoor: e.target.checked })} />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <RainIcon fontSize="small" color="action" />
                                        <Typography variant="body2">Bei Regen: Indoor bevorzugen</Typography>
                                    </Box>
                                }
                            />
                            <FormControlLabel
                                control={<Switch checked={prefs.carAvailable} onChange={(e) => setPrefs({ ...prefs, carAvailable: e.target.checked })} />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CarIcon fontSize="small" color="action" />
                                        <Typography variant="body2">Auto vorhanden</Typography>
                                    </Box>
                                }
                            />
                            <FormControlLabel
                                control={<Switch checked={prefs.kidsIncluded} onChange={(e) => setPrefs({ ...prefs, kidsIncluded: e.target.checked })} />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <KidsIcon fontSize="small" color="action" />
                                        <Typography variant="body2">Kinder dabei</Typography>
                                    </Box>
                                }
                            />
                        </Stack>
                    </Stack>
                )}

                {activeStep === 3 && (
                    <Stack spacing={4}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <NoGoIcon fontSize="small" color="error" /> No-Gos
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                {NO_GOS.map(n => (
                                    <Chip
                                        key={n}
                                        label={n}
                                        onClick={() => toggleNoGo(n)}
                                        color={prefs.noGos.includes(n) ? 'error' : 'default'}
                                        variant={prefs.noGos.includes(n) ? 'filled' : 'outlined'}
                                    />
                                ))}
                            </Box>
                            <TextField
                                fullWidth
                                multiline
                                rows={2}
                                label="Sonstige Notizen"
                                value={prefs.notes}
                                onChange={(e) => setPrefs({ ...prefs, notes: e.target.value })}
                                placeholder="z.B. Allergien, Abneigungen..."
                            />
                        </Box>

                        <Box sx={{ bgcolor: 'primary.50', p: 3, borderRadius: 3, border: '1px solid', borderColor: 'primary.100' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.dark' }}>
                                <AIPreviewIcon fontSize="small" /> Erste Vorschläge (Buchstabe A)
                            </Typography>

                            {generatingPreview ? (
                                <Box sx={{ textAlign: 'center', py: 2 }}>
                                    <CircularProgress size={24} sx={{ mb: 1 }} />
                                    <Typography variant="caption" display="block">Personalisiere Vorschläge...</Typography>
                                </Box>
                            ) : (
                                <List dense disablePadding>
                                    {previewIdeas.map((idea: any, i: number) => (
                                        <ListItem key={i} sx={{ px: 0 }}>
                                            <ListItemIcon sx={{ minWidth: 28 }}>
                                                <CheckIcon fontSize="small" color="success" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{idea.title}</Typography>}
                                                secondary={idea.description}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </Box>
                    </Stack>
                )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    disabled={activeStep === 0 || loading}
                    onClick={handleBack}
                    color="inherit"
                >
                    Zurück
                </Button>
                <Box>
                    <Button
                        onClick={() => navigate('/')}
                        sx={{ mr: 1 }}
                        color="inherit"
                        disabled={loading}
                    >
                        Später
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleNext}
                        disabled={loading}
                        sx={{ px: 4, borderRadius: 2, fontWeight: 700 }}
                    >
                        {loading ? <CircularProgress size={24} /> : activeStep === STEPS.length - 1 ? 'Starten' : 'Weiter'}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
};

export default Onboarding;
