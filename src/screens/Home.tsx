import React, { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Chip, List, ListItem, ListItemText, Box, Divider, ListItemButton } from '@mui/material';
import { ChevronRight as ChevronRightIcon, CheckCircle as CheckCircleIcon, RadioButtonUnchecked as RadioButtonUncheckedIcon, HourglassEmpty as HourglassEmptyIcon } from '@mui/icons-material';
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

    const currentRound = rounds.find(r => r.status !== RoundStatus.Done) || rounds[rounds.length - 1];

    const getStatusLabel = (status: RoundStatus) => {
        switch (status) {
            case RoundStatus.Done: return 'Erledigt';
            case RoundStatus.Confirmed: return 'Bestätigt';
            case RoundStatus.Proposed: return 'Vorgeschlagen';
            default: return 'Nicht gestartet';
        }
    };

    const getStatusIcon = (status: RoundStatus) => {
        switch (status) {
            case RoundStatus.Done: return <CheckCircleIcon color="success" />;
            case RoundStatus.Confirmed: return <CheckCircleIcon color="primary" />;
            case RoundStatus.Proposed: return <HourglassEmptyIcon color="warning" />;
            default: return <RadioButtonUncheckedIcon color="disabled" />;
        }
    };

    const getStatusColor = (status: RoundStatus) => {
        switch (status) {
            case RoundStatus.Done: return 'success';
            case RoundStatus.Confirmed: return 'primary';
            case RoundStatus.Proposed: return 'warning';
            default: return 'default';
        }
    };

    if (rounds.length === 0) return null;

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 500 }}>
                ABC Gift
            </Typography>

            {currentRound && (
                <Card sx={{ mb: 4, bgcolor: 'primary.container', color: 'onPrimaryContainer', cursor: 'pointer' }}
                    onClick={() => navigate(`/letter/${currentRound.letter}`)}>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="overline" sx={{ opacity: 0.8 }}>Aktuelle Runde</Typography>
                        <Typography variant="h1" sx={{ fontSize: { xs: '3.5rem', sm: '5rem' }, my: 1 }}>{currentRound.letter}</Typography>
                        <Typography variant="h6">An der Reihe: {currentRound.proposerUserId === 'mauro' ? 'Mauro' : 'Giorgia'}</Typography>
                        <Chip label={getStatusLabel(currentRound.status)} color={getStatusColor(currentRound.status)} sx={{ mt: 2 }} />
                    </CardContent>
                </Card>
            )}

            <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>Zeitstrahl</Typography>
            <Card>
                <List disablePadding>
                    {rounds.map((round, index) => (
                        <React.Fragment key={round.letter}>
                            <ListItem disablePadding>
                                <ListItemButton
                                    onClick={() => navigate(`/letter/${round.letter}`)}
                                    sx={{
                                        py: 1.5,
                                        px: { xs: 1.5, sm: 2 },
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 2
                                    }}
                                >
                                    <ListItemText
                                        primary={
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>{round.letter}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    • {round.proposerUserId === 'mauro' ? 'Mauro' : 'Giorgia'}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                <Typography variant="body1" color="text.primary" sx={{
                                                    fontWeight: 500,
                                                    mb: 0.5,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: { xs: '200px', sm: '100%' }
                                                }}>
                                                    {round.proposalText || (round.status === RoundStatus.NotStarted ? 'Noch nicht gestartet' : getStatusLabel(round.status))}
                                                </Typography>
                                                {round.date && (
                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                        Datum: {new Date(round.date).toLocaleDateString('de-DE')}
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                        sx={{ m: 0, width: '100%' }}
                                    />
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        ml: 'auto',
                                        flexShrink: 0
                                    }}>
                                        <Chip
                                            size="small"
                                            label={getStatusLabel(round.status)}
                                            color={getStatusColor(round.status)}
                                            variant="outlined"
                                            sx={{ height: 20, fontSize: '0.7rem' }}
                                        />
                                        {getStatusIcon(round.status)}
                                        <ChevronRightIcon color="action" sx={{ ml: 'auto' }} />
                                    </Box>
                                </ListItemButton>
                            </ListItem>
                            {index < rounds.length - 1 && <Divider />}
                        </React.Fragment>
                    ))}
                </List>
            </Card>
        </Container>
    );
};

export default Home;
