import React, { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Button, Box, Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, CircularProgress, TextField, List, ListItem, ListItemText, Chip, IconButton, Stack, Divider, Collapse, Slider, ToggleButtonGroup, ToggleButton, FormControlLabel, Switch } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { storage } from '../storage';
import { auth, db } from '../firebase';
import { Delete as DeleteIcon, Email as MailIcon, ArrowUpward as UpIcon, ArrowDownward as DownIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { useAuth } from '../context/useAuth';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import type { AppSettings, UserProfile, UserPreferences } from '../types';

const Settings: React.FC = () => {
    const { profile, environment, loading: authLoading } = useAuth();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [portalName, setPortalName] = useState('');
    const [showSaved, setShowSaved] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const navigate = useNavigate();

    const normalizedUserEmail = profile?.email.toLowerCase().trim();
    const isAdmin = profile && environment && (
        (environment.adminEmail || environment.memberEmails[0])?.toLowerCase().trim() === normalizedUserEmail
    );

    useEffect(() => {
        if (environment?.id) {
            storage.getSettings(environment.id).then(setSettings);
            storage.getPreferences(environment.id).then(setPreferences);

            // Fetch profiles for all members
            const fetchProfiles = async () => {
                const profiles: Record<string, UserProfile> = {};
                for (const email of environment.memberEmails) {
                    const normalizedEmail = email.toLowerCase().trim();
                    const q = query(collection(db, 'users'), where('email', '==', normalizedEmail));
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        const userData = snap.docs[0].data() as UserProfile;
                        // Diagnostic log to help the developer see what's happening
                        console.log(`Profile found for ${normalizedEmail}:`, userData);
                        if (userData.environmentId === environment.id) {
                            profiles[normalizedEmail] = { ...userData, uid: snap.docs[0].id };
                        }
                    } else {
                        // Fallback case-insensitive check (though Register should have normalized it)
                        const q2 = query(collection(db, 'users'), where('email', '==', email.trim()));
                        const snap2 = await getDocs(q2);
                        if (!snap2.empty) {
                            const userData2 = snap2.docs[0].data() as UserProfile;
                            console.log(`Case-insensitive profile found for ${email.trim()}:`, userData2);
                            if (userData2.environmentId === environment.id) {
                                profiles[normalizedEmail] = { ...userData2, uid: snap2.docs[0].id };
                            }
                        }
                    }
                }
                setMemberProfiles(profiles);
            };
            fetchProfiles();

            // DATA MIGRATION: Ensure emails are lowercase in DB (helps future queries)
            // 1. Environment Migration (More aggressive: rebuild memberNames & memberEmails)
            if (isAdmin) {
                const hasMixedCaseEmails = environment.memberEmails.some((e: string) => e !== e.toLowerCase().trim());
                const mixedCaseNames = Object.keys(environment.memberNames || {}).some(k => k !== k.toLowerCase());
                const needsEnvMigration = hasMixedCaseEmails || mixedCaseNames || !environment.adminEmail;

                if (needsEnvMigration) {
                    const normalizedEmails = [...new Set(environment.memberEmails.map((e: string) => e.toLowerCase().trim()))];
                    const normalizedAdmin = (environment.adminEmail || environment.memberEmails[0]).toLowerCase().trim();

                    // Rebuild memberNames to be exclusively lowercase keys
                    const newMemberNames: Record<string, string> = {};
                    if (environment.memberNames) {
                        Object.entries(environment.memberNames).forEach(([key, value]) => {
                            const normalizedKey = key.toLowerCase();
                            // If there's a conflict, prioritize the one that isn't just the email itself
                            if (!newMemberNames[normalizedKey] || newMemberNames[normalizedKey].includes('@')) {
                                newMemberNames[normalizedKey] = value as string;
                            }
                        });
                    }

                    updateDoc(doc(db, 'environments', environment.id), {
                        memberEmails: normalizedEmails,
                        adminEmail: normalizedAdmin,
                        memberNames: newMemberNames
                    }).catch(err => console.error("Env Migration failed:", err));
                }
            }

            // 2. User Profile Migration (Normalize current user's email if not already)
            if (profile && profile.email !== profile.email.toLowerCase().trim()) {
                updateDoc(doc(db, 'users', profile.uid), {
                    email: profile.email.toLowerCase().trim()
                }).catch(err => console.error("User Profile Migration failed:", err));
            }

            if (environment.name) {
                setPortalName(environment.name);
            }
        }
    }, [environment]);

    const handleSavePortalName = async () => {
        if (!environment || !portalName.trim()) return;
        try {
            await updateDoc(doc(db, 'environments', environment.id), {
                name: portalName.trim()
            });
            setShowSaved(true);
        } catch (e) {
            console.error('Error saving portal name:', e);
        }
    };

    const [showResetDialog, setShowResetDialog] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const handleReset = async () => {
        if (!environment || !settings) return;
        setIsResetting(true);
        const sequence = environment.memberOrder || environment.memberEmails;
        await storage.resetRounds(environment.id, environment.memberEmails, sequence[0], environment.memberOrder);
        navigate('/');
    };

    const [showDeleteDialog, setShowDeleteDialog] = useState<{ open: boolean; email: string }>({ open: false, email: '' });
    const [isDeleting, setIsDeleting] = useState(false);

    const handleRemoveMember = async () => {
        const { email } = showDeleteDialog;
        if (!environment || !profile || !email) return;
        setIsDeleting(true);

        try {
            // 1. Update environment member list
            const normalizedEmail = email.toLowerCase().trim();
            const updatedEmails = environment.memberEmails.filter((e: string) => e.toLowerCase().trim() !== normalizedEmail);
            const envRef = doc(db, 'environments', environment.id);
            const fieldKey = normalizedEmail.replace(/\./g, '_');

            await updateDoc(envRef, {
                memberEmails: updatedEmails,
                [`memberNames.${fieldKey}`]: null
            });

            // 2. Delete ALL user profiles matching any casing variant of this email in our environment
            const variants = [...new Set([normalizedEmail, email.trim()])];
            for (const emailVariant of variants) {
                const q = query(collection(db, 'users'), where('email', '==', emailVariant), where('environmentId', '==', environment.id));
                const snap = await getDocs(q);
                for (const docSnap of snap.docs) {
                    await deleteDoc(doc(db, 'users', docSnap.id));
                    console.log(`Successfully deleted zombie profile: ${docSnap.id} for ${emailVariant}`);
                }
            }

            setShowDeleteDialog({ open: false, email: '' });
            window.location.reload();
        } catch (e) {
            console.error('Error removing member:', e);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleMoveMemberOrder = async (index: number, direction: 'up' | 'down') => {
        if (!environment) return;
        const currentOrder = environment.memberOrder || [...environment.memberEmails];
        const newOrder = [...currentOrder];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newOrder.length) return;

        [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];

        try {
            const envRef = doc(db, 'environments', environment.id);
            await updateDoc(envRef, { memberOrder: newOrder });
        } catch (e) {
            console.error('Error updating member order:', e);
        }
    };

    const [partnerEmail, setPartnerEmail] = useState('');
    const [partnerError, setPartnerError] = useState('');
    const [partnerSuccess, setPartnerSuccess] = useState('');
    const [addingPartner, setAddingPartner] = useState(false);

    const handleAddPartner = async () => {
        if (!environment || !partnerEmail || !profile) return;
        setPartnerError('');
        setPartnerSuccess('');
        setAddingPartner(true);

        const email = partnerEmail.toLowerCase().trim();

        if (environment.memberEmails.length >= 10) {
            setPartnerError('Maximale Anzahl von 10 Mitgliedern erreicht.');
            setAddingPartner(false);
            return;
        }

        if (environment.memberEmails.includes(email)) {
            setPartnerError('Dieser Partner ist bereits Mitglied.');
            setAddingPartner(false);
            return;
        }

        try {
            // 1. Update environment member list
            const updatedMembers = [...environment.memberEmails, email];
            const envRef = doc(db, 'environments', environment.id);
            await updateDoc(envRef, {
                memberEmails: updatedMembers,
                [`memberNames.${email.replace(/\./g, '_')}`]: email // placeholder name
            });

            // 2. NOTE: We REMOVED the automatic update of existing user profiles.
            // Existing users will now see an invitation dialog on Home and have IT accept it explicitly.

            const registrationLink = `${window.location.origin}/register?email=${encodeURIComponent(email)}`;
            setPartnerSuccess(`Partner erfolgreich hinzugefügt!`);
            setPartnerEmail('');

            // Show a dialog or just success text with actions
            setShowInviteInfo({ open: true, email, link: registrationLink });
        } catch (e) {
            console.error('Error adding partner:', e);
            setPartnerError('Fehler beim Hinzufügen des Partners.');
        } finally {
            setAddingPartner(false);
        }
    };

    const [showInviteInfo, setShowInviteInfo] = useState<{ open: boolean; email: string; link: string }>({ open: false, email: '', link: '' });

    const handleUpdatePreference = async (updates: Partial<UserPreferences>) => {
        if (!environment || !preferences) return;
        const newPrefs = { ...preferences, ...updates };
        setPreferences(newPrefs);
        await storage.savePreferences(environment.id, newPrefs);
        setShowSaved(true);
    };

    const toggleStyle = (style: string) => {
        const styles = preferences?.styles || [];
        handleUpdatePreference({
            styles: styles.includes(style)
                ? styles.filter(s => s !== style)
                : [...styles, style]
        });
    };

    const toggleNoGo = (noGo: string) => {
        const noGos = preferences?.noGos || [];
        handleUpdatePreference({
            noGos: noGos.includes(noGo)
                ? noGos.filter(n => n !== noGo)
                : [...noGos, noGo]
        });
    };

    if (authLoading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
    if (!environment || !settings) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 500 }}>Einstellungen</Typography>

            <Card sx={{ mb: 3, border: expanded ? '1px solid' : 'none', borderColor: 'divider', transition: 'all 0.3s ease' }}>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    <Button
                        fullWidth
                        onClick={() => setExpanded(!expanded)}
                        sx={{
                            justifyContent: 'space-between',
                            px: 2,
                            py: 2,
                            color: 'text.primary',
                            textTransform: 'none',
                            bgcolor: expanded ? 'action.hover' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' }
                        }}
                    >
                        <Box sx={{ textAlign: 'left' }}>
                            <Typography variant="h6">Persönliche Vorlieben</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {preferences?.completedAt ? 'Vorlieben anpassen' : 'Setup abschließen'}
                            </Typography>
                        </Box>
                        <ChevronRightIcon sx={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }} color="action" />
                    </Button>

                    <Collapse in={expanded}>
                        <Box sx={{ p: 2, pt: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Divider />

                            {/* Basics */}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>REICHWEITE & SPRACHE</Typography>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" gutterBottom>Radius: {preferences?.radiusKm} km</Typography>
                                        <Slider
                                            size="small"
                                            value={preferences?.radiusKm || 25}
                                            min={5}
                                            max={50}
                                            step={5}
                                            onChange={(_, v) => handleUpdatePreference({ radiusKm: v as number })}
                                        />
                                    </Box>
                                    <ToggleButtonGroup
                                        fullWidth
                                        size="small"
                                        value={preferences?.language || 'de'}
                                        exclusive
                                        onChange={(_, v) => v && handleUpdatePreference({ language: v })}
                                    >
                                        <ToggleButton value="de">Deutsch</ToggleButton>
                                        <ToggleButton value="en">English</ToggleButton>
                                    </ToggleButtonGroup>
                                </Stack>
                            </Box>

                            {/* Timing */}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>TIMING & BUDGET</Typography>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Bevorzugte Tage:</Typography>
                                        <ToggleButtonGroup
                                            fullWidth
                                            size="small"
                                            value={preferences?.planningDays || 'none'}
                                            exclusive
                                            onChange={(_, v) => v && handleUpdatePreference({ planningDays: v })}
                                        >
                                            <ToggleButton value="weekday">Wochentags</ToggleButton>
                                            <ToggleButton value="weekend">Wochenende</ToggleButton>
                                            <ToggleButton value="both">Beides</ToggleButton>
                                            <ToggleButton value="none">Keine</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Tageszeit:</Typography>
                                        <ToggleButtonGroup
                                            fullWidth
                                            size="small"
                                            value={preferences?.timeOfDay || 'none'}
                                            exclusive
                                            onChange={(_, v) => v && handleUpdatePreference({ timeOfDay: v })}
                                        >
                                            <ToggleButton value="morning">Morgens</ToggleButton>
                                            <ToggleButton value="afternoon">Mittags</ToggleButton>
                                            <ToggleButton value="evening">Abends</ToggleButton>
                                            <ToggleButton value="none">Keine</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Budget:</Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            {['low', 'medium', 'high', 'none'].map(b => (
                                                <Chip
                                                    key={b}
                                                    size="small"
                                                    label={b === 'low' ? 'Günstig' : b === 'medium' ? 'Mittel' : b === 'high' ? 'Gehoben' : 'Keine'}
                                                    onClick={() => handleUpdatePreference({ budgetTier: b as any })}
                                                    color={preferences?.budgetTier === b ? 'primary' : 'default'}
                                                    variant={preferences?.budgetTier === b ? 'filled' : 'outlined'}
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                </Stack>
                            </Box>

                            {/* Style */}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>STIL & RAHMEN</Typography>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Indoor / Outdoor:</Typography>
                                        <ToggleButtonGroup
                                            fullWidth
                                            size="small"
                                            value={preferences?.indoorOutdoor || 'none'}
                                            exclusive
                                            onChange={(_, v) => v && handleUpdatePreference({ indoorOutdoor: v })}
                                        >
                                            <ToggleButton value="indoor">Indoor</ToggleButton>
                                            <ToggleButton value="outdoor">Outdoor</ToggleButton>
                                            <ToggleButton value="mix">Mix</ToggleButton>
                                            <ToggleButton value="none">Keine</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Aktivitäts-Stile:</Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {['Entspannung', 'Essen & Trinken', 'Kultur', 'Natur', 'Sport', 'Kreativ', 'Abenteuer', 'Nur Zuhause'].map(s => (
                                                <Chip
                                                    key={s}
                                                    size="small"
                                                    label={s}
                                                    onClick={() => toggleStyle(s)}
                                                    color={preferences?.styles.includes(s) ? 'primary' : 'default'}
                                                    variant={preferences?.styles.includes(s) ? 'filled' : 'outlined'}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                    <Stack>
                                        <FormControlLabel
                                            control={<Switch size="small" checked={preferences?.carAvailable} onChange={(e) => handleUpdatePreference({ carAvailable: e.target.checked })} />}
                                            label={<Typography variant="body2">Auto vorhanden</Typography>}
                                        />
                                        <FormControlLabel
                                            control={<Switch size="small" checked={preferences?.kidsIncluded} onChange={(e) => handleUpdatePreference({ kidsIncluded: e.target.checked })} />}
                                            label={<Typography variant="body2">Kinder dabei</Typography>}
                                        />
                                    </Stack>
                                </Stack>
                            </Box>

                            {/* No-Gos */}
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>AUSSCHLÜSSE</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                    {['Kino', 'Restaurant', 'Wandern', 'Bars/Alkohol', 'Menschenmengen', 'Lautstärke', 'Teuer', 'Lange Fahrtzeit', 'Sportlich'].map(n => (
                                        <Chip
                                            key={n}
                                            size="small"
                                            label={n}
                                            onClick={() => toggleNoGo(n)}
                                            color={preferences?.noGos.includes(n) ? 'error' : 'default'}
                                            variant={preferences?.noGos.includes(n) ? 'filled' : 'outlined'}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        </Box>
                    </Collapse>
                </CardContent>
            </Card>

            {isAdmin && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>ABC Date Reise</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Gib eurer ABC Date Reise einen persönlichen Namen für den Home-Screen.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Name eurer Reise"
                                value={portalName}
                                onChange={(e) => setPortalName(e.target.value)}
                            />
                            <Button
                                variant="contained"
                                onClick={handleSavePortalName}
                                disabled={!portalName.trim() || portalName === environment.name}
                            >
                                Speichern
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {isAdmin && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>Runden-Reihenfolge</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Lege fest, in welcher Reihenfolge die Mitglieder für Vorschläge an der Reihe sind.
                        </Typography>
                        <List sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
                            {(environment.memberOrder || environment.memberEmails).map((email: string, index: number, arr: string[]) => (
                                <ListItem
                                    key={email}
                                    secondaryAction={
                                        <Box>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleMoveMemberOrder(index, 'up')}
                                                disabled={index === 0}
                                            >
                                                <UpIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleMoveMemberOrder(index, 'down')}
                                                disabled={index === arr.length - 1}
                                            >
                                                <DownIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    }
                                    sx={{ py: 0.5 }}
                                >
                                    <ListItemText
                                        primary={environment.memberNames[email.toLowerCase().replace(/\./g, '_')] || email}
                                        primaryTypographyProps={{ variant: 'body2', sx: { fontWeight: 500 } }}
                                        secondary={index === 0 ? "Beginnt (Runde A, C, E...)" : `Folgt als #${index + 1}`}
                                        secondaryTypographyProps={{ variant: 'caption' }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                        <Typography variant="caption" color="info.main" sx={{ mt: 2, display: 'block', fontStyle: 'italic' }}>
                            Änderungen werden beim nächsten "Gesamten Fortschritt zurücksetzen" wirksam.
                        </Typography>
                    </CardContent>
                </Card>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    {isAdmin && (
                        <>
                            <Typography variant="h6" gutterBottom>Partner einladen</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Lade deinen Partner ein, um gemeinsam an eurer ABC Date Reise zu arbeiten.
                            </Typography>

                            {partnerError && <Alert severity="error" sx={{ mb: 2 }}>{partnerError}</Alert>}
                            {partnerSuccess && <Alert severity="success" sx={{ mb: 2 }}>{partnerSuccess}</Alert>}

                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="E-Mail des Partners"
                                    value={partnerEmail}
                                    onChange={(e) => setPartnerEmail(e.target.value)}
                                    disabled={addingPartner}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleAddPartner}
                                    disabled={addingPartner || !partnerEmail}
                                >
                                    {addingPartner ? <CircularProgress size={20} /> : 'Hinzufügen'}
                                </Button>
                            </Box>
                            <Divider sx={{ my: 3 }} />
                        </>
                    )}

                    <Box sx={{ mt: 2 }}>
                        <Typography variant="overline" color="text.secondary">Mitglieder</Typography>
                        <List>
                            {environment.memberEmails.map((email: string) => (
                                <ListItem
                                    key={email}
                                    divider
                                    secondaryAction={
                                        isAdmin && (
                                            <Stack direction="row" spacing={0.5}>
                                                {memberProfiles[email.toLowerCase().trim()]?.environmentId !== environment.id && (
                                                    <IconButton
                                                        edge="end"
                                                        aria-label="resend"
                                                        onClick={() => {
                                                            const normalizedEmail = email.toLowerCase().trim();
                                                            const registrationLink = `${window.location.origin}/register?email=${encodeURIComponent(normalizedEmail)}`;
                                                            setShowInviteInfo({ open: true, email: normalizedEmail, link: registrationLink });
                                                        }}
                                                        color="primary"
                                                        size="small"
                                                    >
                                                        <MailIcon />
                                                    </IconButton>
                                                )}
                                                {email.toLowerCase().trim() !== profile.email.toLowerCase().trim() && (
                                                    <IconButton edge="end" aria-label="remove" onClick={() => setShowDeleteDialog({ open: true, email })} color="error" size="small">
                                                        <DeleteIcon />
                                                    </IconButton>
                                                )}
                                            </Stack>
                                        )
                                    }
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {environment.memberNames[email.toLowerCase().replace(/\./g, '_')] || email}
                                                {email.toLowerCase().trim() === (environment.adminEmail || environment.memberEmails[0])?.toLowerCase().trim() && (
                                                    <Chip size="small" label="Admin" color="primary" variant="filled" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                                                )}
                                                {(() => {
                                                    const isSelf = profile && email.toLowerCase().trim() === profile.email.toLowerCase().trim();
                                                    const isRegistered = isSelf || memberProfiles[email.toLowerCase().trim()]?.environmentId === environment.id;
                                                    return (
                                                        <Chip
                                                            size="small"
                                                            label={isRegistered ? "Registriert" : "Eingeladen"}
                                                            color={isRegistered ? "success" : "warning"}
                                                            variant="outlined"
                                                            onClick={() => {
                                                                if (!isRegistered) {
                                                                    const normalizedEmail = email.toLowerCase().trim();
                                                                    const registrationLink = `${window.location.origin}/register?email=${encodeURIComponent(normalizedEmail)}`;
                                                                    setShowInviteInfo({ open: true, email: normalizedEmail, link: registrationLink });
                                                                }
                                                            }}
                                                            sx={{ cursor: isRegistered ? 'default' : 'pointer' }}
                                                        />
                                                    );
                                                })()}
                                            </Box>
                                        }
                                        secondary={email.trim()}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </CardContent>
            </Card>

            <Dialog open={showDeleteDialog.open} onClose={() => !isDeleting && setShowDeleteDialog({ open: false, email: '' })} PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>Mitglied entfernen?</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Bist du sicher, dass du <strong>{showDeleteDialog.email}</strong> aus dieser ABC Date Reise entfernen möchtest?
                    </DialogContentText>
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                        Das Mitglied verliert sofortigen Zugriff auf alle gemeinsamen Daten. Nach GDPR-Richtlinien werden die Verknüpfungen im System gelöscht.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setShowDeleteDialog({ open: false, email: '' })} color="inherit" disabled={isDeleting}>Abbrechen</Button>
                    <Button onClick={handleRemoveMember} color="error" variant="contained" disabled={isDeleting} sx={{ borderRadius: 2, fontWeight: 700 }}>
                        {isDeleting ? <CircularProgress size={24} /> : 'Mitglied entfernen'}
                    </Button>
                </DialogActions>
            </Dialog>

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
                                const body = encodeURIComponent(`Hallo!\n\nIch habe uns bei ABC Dates angemeldet. Hier ist dein persönlicher Link zu unserer ABC Date Reise:\n\n${showInviteInfo.link}\n\nBis bald!`);
                                window.location.href = `mailto:${showInviteInfo.email}?subject=${subject}&body=${body}`;
                            }}
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
                        >
                            Link kopieren
                        </Button>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setShowInviteInfo({ ...showInviteInfo, open: false })} color="inherit">Schließen</Button>
                </DialogActions>
            </Dialog>

            <Button color="error" fullWidth onClick={() => setShowResetDialog(true)} sx={{ mt: 2, fontWeight: 700 }}>
                Gesamten Fortschritt zurücksetzen
            </Button>

            <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mb: 2 }}>
                    Angemeldet als {auth.currentUser?.email}
                </Typography>
                <Button
                    variant="outlined"
                    color="inherit"
                    fullWidth
                    onClick={() => auth.signOut().then(() => window.location.href = '/login')}
                    sx={{ fontWeight: 700, borderRadius: 2 }}
                >
                    Abmelden
                </Button>
            </Box>

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
        </Container >
    );
};

export default Settings;
