import React, { useEffect, useState } from 'react';
import { Container, Typography, Card, List, ListItem, ListItemText, Box, Divider, IconButton, ListItemButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { storage } from '../storage';
import type { LetterRound } from '../types';
import { RoundStatus } from '../types';

const History: React.FC = () => {
    const [rounds, setRounds] = useState<LetterRound[]>([]);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const navigate = useNavigate();

    const loadRounds = async () => {
        const rs = await storage.getRounds();
        setRounds(rs.filter(r => r.status === RoundStatus.Done));
    };

    useEffect(() => {
        loadRounds();
    }, []);

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        const allRounds = await storage.getRounds();
        const newRounds = allRounds.map(r =>
            r.letter === deleteConfirm
                ? { ...r, status: RoundStatus.NotStarted, proposalText: '', date: undefined, notes: '', updatedAt: new Date().toISOString() }
                : r
        );
        await storage.saveRounds(newRounds);
        setDeleteConfirm(null);
        await loadRounds();
    };

    if (rounds.length === 0) {
        return (
            <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h5" color="text.secondary">Noch keine Geschenke erledigt!</Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>Beende Runden, um sie hier zu sehen.</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 500 }}>Verlauf</Typography>
            <Card>
                <List disablePadding>
                    {rounds.map((round, index) => (
                        <React.Fragment key={round.letter}>
                            <ListItem disablePadding>
                                <ListItemButton
                                    onClick={() => navigate(`/letter/${round.letter}`)}
                                    sx={{
                                        py: 2,
                                        px: { xs: 1.5, sm: 2 },
                                        flexDirection: { xs: 'column', sm: 'row' },
                                        alignItems: { xs: 'flex-start', sm: 'center' },
                                        gap: { xs: 1, sm: 2 }
                                    }}
                                >
                                    <ListItemText
                                        primary={
                                            <Box display="flex" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{round.letter}</Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 500 }}>{round.proposalText}</Typography>
                                            </Box>
                                        }
                                        secondary={`${round.date ? new Date(round.date).toLocaleDateString('de-DE') : 'Kein Datum'} • Von ${round.proposerUserId === 'mauro' ? 'Mauro' : 'Giorgia'}`}
                                        sx={{ m: 0, width: '100%' }}
                                    />
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        ml: { xs: 0, sm: 'auto' },
                                        width: { xs: '100%', sm: 'auto' },
                                        justifyContent: { xs: 'flex-end', sm: 'center' }
                                    }}>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(round.letter); }}
                                            sx={{ bgcolor: 'error.container', color: 'error.main', '&:hover': { bgcolor: 'error.light' } }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); navigate(`/letter/${round.letter}`); }}
                                            sx={{ bgcolor: 'primary.container', color: 'primary.main', '&:hover': { bgcolor: 'primary.light' } }}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </ListItemButton>
                            </ListItem>
                            {index < rounds.length - 1 && <Divider />}
                        </React.Fragment>
                    ))}
                </List>
            </Card>

            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Eintrag löschen?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Möchtest du diese erledigte Runde wirklich löschen? Der Fortschritt wird zurückgesetzt.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Abbrechen</Button>
                    <Button onClick={handleDelete} color="error" autoFocus>Löschen</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default History;
