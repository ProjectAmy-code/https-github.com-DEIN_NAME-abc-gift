import React, { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Button, Box, Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, CircularProgress } from '@mui/material';
import { storage } from '../storage';
import type { AppSettings, UserID } from '../types';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [showSaved, setShowSaved] = useState(false);

    useEffect(() => {
        storage.getSettings().then(setSettings);
    }, []);

    const handleSave = async (newSettings: AppSettings) => {
        await storage.saveSettings(newSettings);
        setSettings(newSettings);
        setShowSaved(true);
    };

    const [showResetDialog, setShowResetDialog] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const handleReset = async () => {
        setIsResetting(true);
        await storage.resetRounds(settings?.startingPerson || 'mauro');
        window.location.href = '/';
    };

    if (!settings) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 500 }}>Einstellungen</Typography>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Präferenzen</Typography>

                    <Box sx={{ mt: 3 }}>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Startperson (Buchstabe A)</InputLabel>
                            <Select
                                value={settings.startingPerson}
                                label="Startperson (Buchstabe A)"
                                onChange={(e) => handleSave({ ...settings, startingPerson: e.target.value as UserID })}
                            >
                                <MenuItem value="mauro">Mauro</MenuItem>
                                <MenuItem value="giorgia">Giorgia</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl fullWidth margin="normal" sx={{ mt: 2 }}>
                            <InputLabel>Zeit-Präferenz</InputLabel>
                            <Select
                                value={settings.timePreference}
                                label="Zeit-Präferenz"
                                onChange={(e) => handleSave({ ...settings, timePreference: e.target.value as any })}
                            >
                                <MenuItem value="weekday">Unter der Woche</MenuItem>
                                <MenuItem value="weekend">Wochenende</MenuItem>
                                <MenuItem value="both">Beides</MenuItem>
                            </Select>
                        </FormControl>

                        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <FormControlLabel
                                control={<Switch checked={settings.activityFilters.indoor} onChange={(e) => handleSave({ ...settings, activityFilters: { ...settings.activityFilters, indoor: e.target.checked } })} />}
                                label={<Typography variant="body2">Indoor-Aktivitäten einschließen</Typography>}
                                sx={{ justifyContent: 'space-between', width: '100%', ml: 0, mr: 0 }}
                                labelPlacement="start"
                            />
                            <FormControlLabel
                                control={<Switch checked={settings.activityFilters.outdoor} onChange={(e) => handleSave({ ...settings, activityFilters: { ...settings.activityFilters, outdoor: e.target.checked } })} />}
                                label={<Typography variant="body2">Outdoor-Aktivitäten einschließen</Typography>}
                                sx={{ justifyContent: 'space-between', width: '100%', ml: 0, mr: 0 }}
                                labelPlacement="start"
                            />
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            <Button color="error" fullWidth onClick={() => setShowResetDialog(true)} sx={{ mt: 2, fontWeight: 700 }}>
                Gesamten Fortschritt zurücksetzen
            </Button>

            <Dialog open={showResetDialog} onClose={() => !isResetting && setShowResetDialog(false)} PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>Fortschritt zurücksetzen?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Dies wird all deinen Fortschritt, Vorschläge und Bewertungen unwiderruflich löschen. Bist du sicher?
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setShowResetDialog(false)} color="inherit" disabled={isResetting} sx={{ fontWeight: 700 }}>Abbrechen</Button>
                    <Button onClick={handleReset} color="error" variant="contained" disabled={isResetting} sx={{ fontWeight: 700, borderRadius: 2 }}>
                        {isResetting ? <CircularProgress size={24} /> : 'Zurücksetzen'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={showSaved} autoHideDuration={3000} onClose={() => setShowSaved(false)}>
                <Alert severity="success">Einstellungen gespeichert!</Alert>
            </Snackbar>
        </Container>
    );
};

export default Settings;
