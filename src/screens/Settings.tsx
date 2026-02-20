import React, { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Button, Box, Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, CircularProgress, TextField, List, ListItem, ListItemText, Chip, IconButton, Stack, Divider, Collapse, Slider, ToggleButtonGroup, ToggleButton, FormControlLabel, Switch, Autocomplete, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { storage } from '../storage';
import { auth, db } from '../firebase';
import { Delete as DeleteIcon, Email as MailIcon, ArrowUpward as UpIcon, ArrowDownward as DownIcon, ChevronRight as ChevronRightIcon, Shuffle as ShuffleIcon, Sort as SortIcon, PhotoCamera as PhotoCameraIcon } from '@mui/icons-material';
import { useAuth } from '../context/useAuth';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import type { AppSettings, UserProfile, UserPreferences } from '../types';
import { resizeImage } from '../utils/imageUtils';

const GERMAN_CITIES = [
    'Aachen', 'Augsburg', 'Bamberg', 'Bayreuth', 'Berlin', 'Bielefeld', 'Bochum',
    'Bonn', 'Braunschweig', 'Bremen', 'Bremerhaven', 'Chemnitz', 'Cottbus',
    'Darmstadt', 'Dortmund', 'Dresden', 'Duisburg', 'Düsseldorf', 'Erfurt',
    'Erlangen', 'Essen', 'Flensburg', 'Frankfurt am Main', 'Freiburg', 'Fürth',
    'Gelsenkirchen', 'Gera', 'Göttingen', 'Hagen', 'Halle (Saale)', 'Hamburg',
    'Hamm', 'Hannover', 'Heidelberg', 'Heilbronn', 'Hildesheim', 'Ingolstadt',
    'Jena', 'Karlsruhe', 'Kassel', 'Kiel', 'Koblenz', 'Köln', 'Konstanz',
    'Krefeld', 'Leipzig', 'Leverkusen', 'Lübeck', 'Ludwigshafen', 'Magdeburg',
    'Mainz', 'Mannheim', 'Moers', 'Mönchengladbach', 'Mülheim an der Ruhr',
    'München', 'Münster', 'Neuss', 'Nürnberg', 'Oberhausen', 'Offenbach',
    'Oldenburg', 'Osnabrück', 'Paderborn', 'Pforzheim', 'Potsdam', 'Recklinghausen',
    'Regensburg', 'Remscheid', 'Rostock', 'Saarbrücken', 'Salzgitter', 'Schwerin',
    'Siegen', 'Solingen', 'Stuttgart', 'Trier', 'Tübingen', 'Ulm', 'Wiesbaden',
    'Wolfsburg', 'Wuppertal', 'Würzburg', 'Zwickau'
];

const Settings: React.FC = () => {
    const { profile, environment, loading: authLoading } = useAuth();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [portalName, setPortalName] = useState('');
    const [showSaved, setShowSaved] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [myName, setMyName] = useState('');
    const [myAge, setMyAge] = useState<string>('');
    const [myAboutMe, setMyAboutMe] = useState('');
    const [myCity, setMyCity] = useState('');
    const [myPhotoURL, setMyPhotoURL] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const navigate = useNavigate();

    const normalizedUserEmail = profile?.email.toLowerCase().trim();
    const isAdmin = profile && environment && (
        (environment.adminEmail || environment.memberEmails[0])?.toLowerCase().trim() === normalizedUserEmail
    );

    useEffect(() => {
        if (environment?.id) {
            storage.getSettings(environment.id).then(setSettings);
            storage.getPreferences(environment.id, profile?.email).then(setPreferences);

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

            // Load own display name, age, about, city, and photo
            if (profile) {
                const normalizedKey = profile.email.toLowerCase().trim().replace(/\./g, '_');
                setMyName(environment.memberNames?.[normalizedKey] || profile.email);
                getDoc(doc(db, 'users', profile.uid)).then(snap => {
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data.age) setMyAge(String(data.age));
                        if (data.aboutMe) setMyAboutMe(data.aboutMe);
                        if (data.city) setMyCity(data.city);
                        if (data.photoURL) setMyPhotoURL(data.photoURL);
                    }
                }).catch(() => { });
            }

            // CLEANUP: Ensure memberOrder only contains emails that are in memberEmails
            if (isAdmin && environment.memberOrder) {
                const normalizedMemberEmails = new Set(environment.memberEmails.map((e: string) => e.toLowerCase().trim()));
                const cleanedOrder = environment.memberOrder.filter((e: string) => normalizedMemberEmails.has(e.toLowerCase().trim()));
                // Add any memberEmails that are missing from memberOrder
                for (const email of environment.memberEmails) {
                    const norm = email.toLowerCase().trim();
                    if (!cleanedOrder.some((e: string) => e.toLowerCase().trim() === norm)) {
                        cleanedOrder.push(norm);
                    }
                }
                // If order changed, persist the cleanup
                const orderChanged = cleanedOrder.length !== environment.memberOrder.length ||
                    cleanedOrder.some((e: string, i: number) => e !== environment.memberOrder![i]);
                if (orderChanged) {
                    updateDoc(doc(db, 'environments', environment.id), {
                        memberOrder: cleanedOrder
                    }).then(() => {
                        // Also re-assign proposers for future rounds
                        storage.reassignUpcomingProposers(environment.id, cleanedOrder);
                    }).catch(err => console.error("MemberOrder cleanup failed:", err));
                }
            }

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

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !profile) return;

        setUploadingImage(true);
        try {
            // Check file size (max 5MB to resize)
            if (file.size > 5 * 1024 * 1024) {
                alert('Das Bild ist zu groß. Bitte wähle ein Bild unter 5MB.');
                return;
            }

            const base64Img = await resizeImage(file, 256, 256);
            if (base64Img) {
                await updateDoc(doc(db, 'users', profile.uid), {
                    photoURL: base64Img
                });
                setMyPhotoURL(base64Img);
                setShowSaved(true);
            }
        } catch (e) {
            console.error('Error uploading image:', e);
            alert('Fehler beim Hochladen des Bildes.');
        } finally {
            setUploadingImage(false);
        }
    };

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
        // Sync memberOrder to current memberEmails and clear drawnOrder before resetting
        const cleanedOrder = environment.memberEmails.map((e: string) => e.toLowerCase().trim());
        await updateDoc(doc(db, 'environments', environment.id), {
            memberOrder: cleanedOrder,
            drawnOrder: []
        });
        await storage.resetRounds(environment.id, environment.memberEmails, cleanedOrder[0], cleanedOrder);
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

            // 2. Re-assign upcoming proposers for future rounds
            // Ensure we use memberOrder if it exists, otherwise memberEmails, then filter
            const currentOrder = environment.memberOrder || environment.memberEmails;
            const updatedOrder = currentOrder.filter((e: string) => e.toLowerCase().trim() !== normalizedEmail);

            // Update memberOrder in DB as well to keep it in sync
            await updateDoc(envRef, {
                memberOrder: updatedOrder
            });

            await storage.reassignUpcomingProposers(environment.id, updatedOrder);

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
            await storage.reassignUpcomingProposers(environment.id, newOrder);
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

            // 2. Re-assign upcoming proposers for future rounds
            const currentOrder = environment.memberOrder || environment.memberEmails;
            const updatedOrder = [...currentOrder, email];

            // Update memberOrder in DB as well to keep it in sync
            await updateDoc(envRef, {
                memberOrder: updatedOrder
            });

            await storage.reassignUpcomingProposers(environment.id, updatedOrder);

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
        await storage.savePreferences(environment.id, newPrefs, profile?.email);
        setShowSaved(true);
    };

    const toggleArrayPref = (field: keyof UserPreferences, value: string) => {
        const currentArray = (preferences?.[field] as string[]) || [];
        handleUpdatePreference({
            [field]: currentArray.includes(value)
                ? currentArray.filter(v => v !== value)
                : [...currentArray, value]
        });
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

            {/* ===== MEIN PROFIL (for ALL users) ===== */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Mein Profil</Typography>

                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { xs: 'center', sm: 'flex-start' } }}>
                        {/* Left Side: Avatar Upload */}
                        <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Button
                                component="label"
                                sx={{
                                    p: 0, minWidth: 0, borderRadius: '50%',
                                    '&:hover .overlay': { opacity: 1 }
                                }}
                                disabled={uploadingImage}
                            >
                                <Avatar
                                    src={myPhotoURL || undefined}
                                    sx={{ width: 100, height: 100, fontSize: '2.5rem', bgcolor: 'primary.main' }}
                                >
                                    {!myPhotoURL && myName ? myName.substring(0, 2).toUpperCase() : '?'}
                                </Avatar>

                                <Box
                                    className="overlay"
                                    sx={{
                                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                        borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.5)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: uploadingImage ? 1 : 0, transition: 'opacity 0.2s',
                                        color: 'white'
                                    }}
                                >
                                    {uploadingImage ? <CircularProgress size={24} color="inherit" /> : <PhotoCameraIcon fontSize="large" />}
                                </Box>
                                <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                            </Button>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Bild ändern</Typography>
                        </Box>

                        {/* Right Side: Fields */}
                        <Stack spacing={2} sx={{ flexGrow: 1, width: '100%' }}>
                            <TextField
                                fullWidth
                                label="Dein Name"
                                value={myName}
                                onChange={(e) => setMyName(e.target.value)}
                                size="small"
                                onBlur={async () => {
                                    if (!environment || !profile || !myName.trim()) return;
                                    const normalizedKey = profile.email.toLowerCase().trim().replace(/\./g, '_');
                                    await updateDoc(doc(db, 'environments', environment.id), {
                                        [`memberNames.${normalizedKey}`]: myName.trim()
                                    });
                                    setShowSaved(true);
                                }}
                            />

                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    label="Dein Alter"
                                    value={myAge}
                                    onChange={(e) => setMyAge(e.target.value.replace(/[^0-9]/g, ''))}
                                    size="small"
                                    type="number"
                                    inputProps={{ min: 1, max: 120 }}
                                    sx={{ width: 120 }}
                                    onBlur={async () => {
                                        if (!profile || !myAge) return;
                                        await updateDoc(doc(db, 'users', profile.uid), {
                                            age: parseInt(myAge)
                                        });
                                        setShowSaved(true);
                                    }}
                                />

                                <Autocomplete
                                    freeSolo
                                    size="small"
                                    options={GERMAN_CITIES}
                                    value={myCity}
                                    onChange={async (_e, newValue) => {
                                        const val = (newValue as string) || '';
                                        setMyCity(val);
                                        if (profile) {
                                            await updateDoc(doc(db, 'users', profile.uid), { city: val });
                                            setShowSaved(true);
                                        }
                                    }}
                                    onInputChange={(_e, newInput) => setMyCity(newInput)}
                                    onBlur={async () => {
                                        if (profile) {
                                            await updateDoc(doc(db, 'users', profile.uid), { city: myCity });
                                            setShowSaved(true);
                                        }
                                    }}
                                    renderInput={(params) => (
                                        <TextField {...params} fullWidth label="Standort" variant="outlined" placeholder="z.B. Berlin" />
                                    )}
                                    sx={{ flexGrow: 1 }}
                                />
                            </Box>

                            <TextField
                                fullWidth
                                label="Über mich (Optional)"
                                value={myAboutMe}
                                onChange={(e) => setMyAboutMe(e.target.value)}
                                size="small"
                                multiline
                                rows={2}
                                placeholder="Ein paar Worte über dich..."
                                onBlur={async () => {
                                    if (!profile) return;
                                    await updateDoc(doc(db, 'users', profile.uid), {
                                        aboutMe: myAboutMe.trim()
                                    });
                                    setShowSaved(true);
                                }}
                            />
                        </Stack>
                    </Box>
                </CardContent>
            </Card>

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
                            <Typography variant="h6">Meine persönlichen Vorlieben</Typography>
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
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>REICHWEITE</Typography>
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
                                </Stack>
                            </Box>

                            {/* Timing */}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>TIMING & BUDGET</Typography>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Bevorzugte Tage:</Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            {[{ v: 'weekday', l: 'Wochentags' }, { v: 'weekend', l: 'Wochenende' }].map(d => (
                                                <Chip
                                                    key={d.v}
                                                    size="small"
                                                    label={d.l}
                                                    onClick={() => toggleArrayPref('planningDays', d.v)}
                                                    color={(preferences?.planningDays || []).includes(d.v) ? 'primary' : 'default'}
                                                    variant={(preferences?.planningDays || []).includes(d.v) ? 'filled' : 'outlined'}
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Typische Dauer:</Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            {[
                                                { v: '30-60', l: '30-60 Min' },
                                                { v: '60-120', l: '1-2 Std' },
                                                { v: '2-4h', l: '2-4 Std' },
                                                { v: 'half-day', l: 'Halber Tag' },
                                                { v: 'full-day', l: 'Ganzer Tag' }
                                            ].map(d => (
                                                <Chip
                                                    key={d.v}
                                                    size="small"
                                                    label={d.l}
                                                    onClick={() => toggleArrayPref('durationTier', d.v)}
                                                    color={(preferences?.durationTier || []).includes(d.v) ? 'secondary' : 'default'}
                                                    variant={(preferences?.durationTier || []).includes(d.v) ? 'filled' : 'outlined'}
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Tageszeit:</Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            {[{ v: 'morning', l: 'Morgens' }, { v: 'afternoon', l: 'Mittags' }, { v: 'evening', l: 'Abends' }].map(d => (
                                                <Chip
                                                    key={d.v}
                                                    size="small"
                                                    label={d.l}
                                                    onClick={() => toggleArrayPref('timeOfDay', d.v)}
                                                    color={(preferences?.timeOfDay || []).includes(d.v) ? 'primary' : 'default'}
                                                    variant={(preferences?.timeOfDay || []).includes(d.v) ? 'filled' : 'outlined'}
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Budget:</Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            {['low', 'medium', 'high'].map(b => (
                                                <Chip
                                                    key={b}
                                                    size="small"
                                                    label={b === 'low' ? 'Günstig' : b === 'medium' ? 'Mittel' : 'Gehoben'}
                                                    onClick={() => toggleArrayPref('budgetTier', b)}
                                                    color={(preferences?.budgetTier || []).includes(b) ? 'primary' : 'default'}
                                                    variant={(preferences?.budgetTier || []).includes(b) ? 'filled' : 'outlined'}
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
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            {[{ v: 'indoor', l: 'Indoor' }, { v: 'outdoor', l: 'Outdoor' }].map(d => (
                                                <Chip
                                                    key={d.v}
                                                    size="small"
                                                    label={d.l}
                                                    onClick={() => toggleArrayPref('indoorOutdoor', d.v)}
                                                    color={(preferences?.indoorOutdoor || []).includes(d.v) ? 'primary' : 'default'}
                                                    variant={(preferences?.indoorOutdoor || []).includes(d.v) ? 'filled' : 'outlined'}
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>Aktivitäts-Stile:</Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {['Entspannung', 'Essen & Trinken', 'Kultur', 'Natur', 'Sport', 'Kreativ', 'Abenteuer', 'Nur Zuhause', 'Romantik', 'Action', 'Wellness', 'Lernen'].map(s => (
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
                                    {['Kino', 'Restaurant', 'Wandern', 'Bars/Alkohol', 'Menschenmengen', 'Lautstärke', 'Teuer', 'Lange Fahrtzeit', 'Sportlich', 'Spaßbad', 'Tiere', 'Drecksarbeit'].map(n => (
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
                        <Typography variant="h6" gutterBottom>Unsere Reise</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Gib eurer ABC Date Reise einen persönlichen Namen für den Home-Screen.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Name eurer Reise"
                                value={portalName}
                                onChange={(e) => setPortalName(e.target.value)}
                                onBlur={handleSavePortalName}
                                helperText="Wird automatisch gespeichert."
                            />
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ pr: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Reise veröffentlichen</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Macht eure Reise öffentlich sichtbar. Euer Reise-Name und eine Zusammenfassung eurer Dates können dann in einer zukünftigen Rangliste (Charts) auftauchen.
                                </Typography>
                            </Box>
                            <Switch
                                checked={!!environment.isPublic}
                                onChange={async (e) => {
                                    try {
                                        await updateDoc(doc(db, 'environments', environment.id), {
                                            isPublic: e.target.checked
                                        });
                                        setShowSaved(true);
                                    } catch (err) {
                                        console.error('Error saving public toggle:', err);
                                    }
                                }}
                                color="primary"
                            />
                        </Box>
                    </CardContent>
                </Card>
            )}

            {isAdmin && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>ABC Modus</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Wähle, wie die Buchstaben durchgegangen werden.
                        </Typography>
                        <ToggleButtonGroup
                            fullWidth
                            size="small"
                            value={environment.abcMode || 'sequential'}
                            exclusive
                            onChange={async (_, v) => {
                                if (!v || !environment) return;
                                try {
                                    await updateDoc(doc(db, 'environments', environment.id), {
                                        abcMode: v,
                                        ...(v === 'random' && !environment.drawnOrder ? { drawnOrder: [] } : {})
                                    });
                                    setShowSaved(true);
                                } catch (e) {
                                    console.error('Error saving ABC mode:', e);
                                }
                            }}
                        >
                            <ToggleButton value="sequential" sx={{ gap: 1 }}>
                                <SortIcon fontSize="small" /> Der Reihe nach
                            </ToggleButton>
                            <ToggleButton value="random" sx={{ gap: 1 }}>
                                <ShuffleIcon fontSize="small" /> Zufällig
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </CardContent>
                </Card>
            )}

            {isAdmin && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>Event-Rhythmus</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Lege fest, in welchen Abständen eure Dates stattfinden sollen.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                                size="small"
                                type="number"
                                label="Alle"
                                value={environment.eventInterval?.value || 1}
                                onChange={async (e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    if (val < 1) return;
                                    try {
                                        await updateDoc(doc(db, 'environments', environment.id), {
                                            'eventInterval.value': val,
                                            'eventInterval.unit': environment.eventInterval?.unit || 'weeks'
                                        });
                                        setShowSaved(true);
                                    } catch (err) { console.error(err); }
                                }}
                                InputProps={{ inputProps: { min: 1, max: 365 } }}
                                sx={{ width: 100 }}
                            />
                            <TextField
                                select
                                size="small"
                                value={environment.eventInterval?.unit || 'weeks'}
                                onChange={async (e) => {
                                    try {
                                        await updateDoc(doc(db, 'environments', environment.id), {
                                            'eventInterval.unit': e.target.value,
                                            'eventInterval.value': environment.eventInterval?.value || 1
                                        });
                                        setShowSaved(true);
                                    } catch (err) { console.error(err); }
                                }}
                                SelectProps={{ native: true }}
                                sx={{ minWidth: 120 }}
                            >
                                <option value="days">Tage(n)</option>
                                <option value="weeks">Woche(n)</option>
                                <option value="months">Monate(n)</option>
                            </TextField>
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
                            {(() => {
                                // Compute effective member order: filter memberOrder to only include actual members
                                const normalizedMemberEmails = new Set(environment.memberEmails.map((e: string) => e.toLowerCase().trim()));
                                const baseOrder = environment.memberOrder || environment.memberEmails;
                                const effectiveOrder = baseOrder.filter((e: string) => normalizedMemberEmails.has(e.toLowerCase().trim()));
                                // Add any memberEmails missing from the order
                                for (const email of environment.memberEmails) {
                                    const norm = email.toLowerCase().trim();
                                    if (!effectiveOrder.some((e: string) => e.toLowerCase().trim() === norm)) {
                                        effectiveOrder.push(norm);
                                    }
                                }
                                return effectiveOrder;
                            })().map((email: string, index: number, arr: string[]) => (
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

            {isAdmin && (
                <Button color="error" fullWidth onClick={() => setShowResetDialog(true)} sx={{ mt: 2, fontWeight: 700 }}>
                    Gesamten Fortschritt zurücksetzen
                </Button>
            )}

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
