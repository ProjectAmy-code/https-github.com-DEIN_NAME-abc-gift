import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, Stack, IconButton,
    Paper, Snackbar, Alert,
    CircularProgress
} from '@mui/material';
import {
    Close as CloseIcon,
    Instagram as InstagramIcon,
    Facebook as FacebookIcon,
    MusicNote as TikTokIcon,
    MilitaryTech as MedalIcon,
    CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import type { LetterRound, UserProfile } from '../types';
import { RoundStatus } from '../types';

interface SocialShareDialogProps {
    open: boolean;
    onClose: () => void;
    round: LetterRound | null;
    profile: UserProfile | null;
}

type Platform = 'instagram' | 'facebook' | 'tiktok';

const SocialShareDialog: React.FC<SocialShareDialogProps> = ({
    open, onClose, round, profile
}) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [platform, setPlatform] = useState<Platform>('instagram');
    const [isPosting, setIsPosting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const isDone = round?.status === RoundStatus.Done;

    const handlePlatformSelect = (p: Platform) => {
        setPlatform(p);
        setStep(2);
    };

    const handlePost = () => {
        setIsPosting(true);
        setTimeout(() => {
            setIsPosting(false);
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                onClose();
                setStep(1);
            }, 3000);
        }, 1500);
    };

    const platforms = [
        { id: 'instagram' as Platform, name: 'Instagram', icon: <InstagramIcon />, color: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' },
        { id: 'facebook' as Platform, name: 'Facebook', icon: <FacebookIcon />, color: '#1877F2' },
        { id: 'tiktok' as Platform, name: 'TikTok', icon: <TikTokIcon />, color: '#000000' },
    ];

    const renderPreview = () => {
        if (!round) return null;

        return (
            <Paper elevation={8} sx={{
                width: '100%',
                aspectRatio: platform === 'tiktok' || platform === 'instagram' ? '9/16' : '1/1',
                maxHeight: platform === 'tiktok' || platform === 'instagram' ? 440 : 380,
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                background: isDone
                    ? 'linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2.5,
                color: 'white',
                mx: 'auto'
            }}>
                <Box sx={{
                    position: 'absolute',
                    top: 20,
                    left: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    opacity: 0.8
                }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 1 }}>ABC DATES</Typography>
                </Box>

                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{ textAlign: 'center', width: '100%' }}
                >
                    {!isDone ? (
                        <>
                            <Box sx={{
                                width: 80,
                                height: 80,
                                borderRadius: 3,
                                bgcolor: 'rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 'auto',
                                mb: 2,
                                border: '2px solid rgba(255,255,255,0.4)'
                            }}>
                                <Typography variant="h3" sx={{ fontWeight: 900 }}>{round.letter}</Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                                Nächster Stopp: "{round.letter}"
                            </Typography>
                            <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                {profile?.displayName ? `${profile.displayName} plant` : 'Wir planen'} unser nächstes Date! 🥂
                            </Typography>
                        </>
                    ) : (
                        <>
                            {round.imageUrls && round.imageUrls.length > 0 ? (
                                <Box sx={{ position: 'relative', height: 160, mb: 3, width: '100%' }}>
                                    {[...round.imageUrls].reverse().slice(0, 3).map((url, i) => (
                                        <Box key={i} sx={{
                                            position: 'absolute',
                                            top: i * 10,
                                            left: '50%',
                                            transform: `translateX(-50%) rotate(${i % 2 === 0 ? '-5' : '5'}deg)`,
                                            width: 140,
                                            height: 140,
                                            borderRadius: 2,
                                            border: '4px solid white',
                                            boxShadow: 3,
                                            overflow: 'hidden',
                                            zIndex: 3 - i,
                                            opacity: 1 - (i * 0.2)
                                        }}>
                                            <img src={url} alt="Memory" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </Box>
                                    ))}
                                </Box>
                            ) : (
                                <Box sx={{ mb: 2 }}>
                                    <MedalIcon sx={{ fontSize: 80, color: '#FFD700' }} />
                                </Box>
                            )}
                            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>
                                Buchstabe {round.letter}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                {round.proposalText}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9, fontStyle: 'italic' }}>
                                "Geschafft! Ein unvergessliches ABC Date ❤️"
                            </Typography>
                        </>
                    )}
                </motion.div>

                <Box sx={{ position: 'absolute', bottom: 20, textAlign: 'center', width: '100%' }}>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>
                        product of ABC Dates
                    </Typography>
                </Box>
            </Paper>
        );
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
            >
                <DialogTitle sx={{
                    fontWeight: 800,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: 'grey.50'
                }}>
                    {step === 1 ? 'Teilen auf...' : 'Vorschau'}
                    <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: 3 }}>
                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.div
                                key="step1"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 20, opacity: 0 }}
                            >
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    {platforms.map((p) => (
                                        <Button
                                            key={p.id}
                                            variant="contained"
                                            size="large"
                                            startIcon={p.icon}
                                            onClick={() => handlePlatformSelect(p.id)}
                                            sx={{
                                                background: p.color,
                                                '&:hover': { opacity: 0.9, background: p.color },
                                                height: 64,
                                                borderRadius: 3,
                                                fontWeight: 700,
                                                fontSize: '1.1rem',
                                                textTransform: 'none'
                                            }}
                                        >
                                            {p.name}
                                        </Button>
                                    ))}
                                </Stack>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="step2"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                            >
                                {renderPreview()}

                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
                                    Wird als {platform === 'facebook' ? 'Post' : 'Story'} formatiert.
                                </Typography>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </DialogContent>

                <DialogActions sx={{ p: 3, pt: 0, justifyContent: step === 2 ? 'space-between' : 'flex-end' }}>
                    {step === 2 && (
                        <Button onClick={() => setStep(1)} color="inherit" sx={{ fontWeight: 700 }}>Zurück</Button>
                    )}
                    {step === 2 && (
                        <Button
                            variant="contained"
                            disabled={isPosting}
                            onClick={handlePost}
                            sx={{
                                borderRadius: 3,
                                px: { xs: 2.5, sm: 4 },
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                                minWidth: 'max-content',
                                background: platforms.find(p => p.id === platform)?.color
                            }}
                        >
                            {isPosting ? <CircularProgress size={24} color="inherit" /> : `Auf ${platforms.find(p => p.id === platform)?.name} posten`}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            <Snackbar open={showSuccess} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert icon={<CheckCircleIcon />} severity="success" sx={{ borderRadius: 3, fontWeight: 700 }}>
                    Erfolgreich auf {platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : 'TikTok'} geteilt!
                </Alert>
            </Snackbar>
        </>
    );
};

export default SocialShareDialog;
