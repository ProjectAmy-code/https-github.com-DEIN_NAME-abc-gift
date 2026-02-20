import React, { useState, useEffect, useRef } from 'react';
import { Container, Typography, CircularProgress, Box, Accordion, AccordionSummary, AccordionDetails, Divider, Stack, Chip, IconButton } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Star as StarIcon, ChevronLeft as LeftIcon, ChevronRight as RightIcon } from '@mui/icons-material';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/useAuth';
import type { Environment, LetterRound } from '../types';
import { RoundStatus } from '../types';

interface PublicJourneyData {
    env: Environment;
    publishedRounds: LetterRound[];
    totalDoneCount: number;
    points: number;
    isOwnJourney?: boolean;
}

interface Story {
    envId: string;
    coupleName: string;
    letter: string;
    date: Date;
    isViewed: boolean;
}

const ImageCarousel: React.FC<{ images: string[], letter: string }> = ({ images, letter }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const index = Math.round(scrollLeft / clientWidth);
            setActiveIndex(index);
        }
    };

    const scrollToIndex = (index: number) => {
        if (scrollRef.current) {
            const { clientWidth } = scrollRef.current;
            scrollRef.current.scrollTo({
                left: index * clientWidth,
                behavior: 'smooth'
            });
        }
    };

    if (images.length === 0) return null;

    return (
        <Box sx={{ position: 'relative', mb: 1.5, group: 'true' }}>
            <Box
                ref={scrollRef}
                onScroll={handleScroll}
                sx={{
                    width: '100%',
                    display: 'flex',
                    overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    scrollBehavior: 'smooth',
                    '&::-webkit-scrollbar': { display: 'none' },
                    scrollbarWidth: 'none',
                    borderRadius: 0,
                }}
            >
                {images.map((url, idx) => (
                    <Box
                        key={idx}
                        sx={{
                            flex: '0 0 100%',
                            scrollSnapAlign: 'start',
                            aspectRatio: '1/1',
                            bgcolor: '#f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <img
                            src={url}
                            alt={`Date ${letter} ${idx}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </Box>
                ))}
            </Box>

            {/* Navigation Arrows */}
            {images.length > 1 && (
                <>
                    <IconButton
                        onClick={() => scrollToIndex(activeIndex - 1)}
                        disabled={activeIndex === 0}
                        sx={{
                            position: 'absolute',
                            left: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            bgcolor: 'rgba(255,255,255,0.7)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                            zIndex: 2,
                            opacity: activeIndex === 0 ? 0 : 1,
                            transition: 'opacity 0.2s',
                            width: 32,
                            height: 32
                        }}
                    >
                        <LeftIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        onClick={() => scrollToIndex(activeIndex + 1)}
                        disabled={activeIndex === images.length - 1}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            bgcolor: 'rgba(255,255,255,0.7)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                            zIndex: 2,
                            opacity: activeIndex === images.length - 1 ? 0 : 1,
                            transition: 'opacity 0.2s',
                            width: 32,
                            height: 32
                        }}
                    >
                        <RightIcon fontSize="small" />
                    </IconButton>
                </>
            )}

            {/* Dots */}
            {images.length > 1 && (
                <Box sx={{
                    position: 'absolute',
                    bottom: 12,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 0.8,
                    zIndex: 2
                }}>
                    {images.map((_, idx) => (
                        <Box
                            key={idx}
                            onClick={() => scrollToIndex(idx)}
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: activeIndex === idx ? 'white' : 'rgba(255,255,255,0.5)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                transform: activeIndex === idx ? 'scale(1.2)' : 'scale(1)'
                            }}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
};

const Ranking: React.FC = () => {
    const [publicJourneys, setPublicJourneys] = useState<PublicJourneyData[]>([]);
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedEnvId, setExpandedEnvId] = useState<string | null>(null);
    const { environment: currentUserEnv } = useAuth();
    const accordionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const markStoryAsViewed = (envId: string, letter: string) => {
        const viewedKey = `viewed_story_${envId}_${letter}`;
        localStorage.setItem(viewedKey, 'true');

        setStories(prev => {
            const updated = prev.map(s => s.envId === envId ? { ...s, isViewed: true } : s);
            // Re-sort: unviewed first, then by date
            return updated.sort((a, b) => {
                if (a.isViewed !== b.isViewed) return a.isViewed ? 1 : -1;
                return b.date.getTime() - a.date.getTime();
            });
        });
    };

    const handleStoryClick = (envId: string, letter: string) => {
        markStoryAsViewed(envId, letter);
        setExpandedEnvId(envId);

        setTimeout(() => {
            const element = accordionRefs.current[envId];
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    useEffect(() => {
        const fetchPublicJourneys = async () => {
            try {
                const journeysData: PublicJourneyData[] = [];
                const processedEnvIds = new Set<string>();

                // 1. Fetch current user's journey if available
                if (currentUserEnv) {
                    const roundsSnapshot = await getDocs(collection(db, 'environments', currentUserEnv.id, 'rounds'));
                    const publishedRounds: LetterRound[] = [];
                    let totalDone = 0;
                    let totalImages = 0;

                    roundsSnapshot.forEach(roundDoc => {
                        const r = roundDoc.data() as LetterRound;
                        if (r.status === RoundStatus.Done) {
                            totalDone++;
                            const imgCount = (r.imageUrls?.length || 0) + (r.imageUrl && !r.imageUrls?.includes(r.imageUrl) ? 1 : 0);
                            totalImages += imgCount;

                            if (r.publishReview) {
                                publishedRounds.push(r);
                            }
                        }
                    });

                    publishedRounds.sort((a, b) => a.letter.localeCompare(b.letter));
                    const points = (totalDone * 100) + (totalImages * 25);

                    journeysData.push({
                        env: currentUserEnv,
                        publishedRounds,
                        totalDoneCount: totalDone,
                        points,
                        isOwnJourney: true
                    });
                    processedEnvIds.add(currentUserEnv.id);
                }

                // 2. Fetch all other public journeys
                const q = query(
                    collection(db, 'environments'),
                    where('isPublic', '==', true)
                );
                const querySnapshot = await getDocs(q);

                const otherJourneys: PublicJourneyData[] = [];
                for (const envDoc of querySnapshot.docs) {
                    if (processedEnvIds.has(envDoc.id)) continue;

                    const env = envDoc.data() as Environment;
                    if (env.name && env.name.trim() !== '') {
                        const roundsSnapshot = await getDocs(collection(db, 'environments', env.id, 'rounds'));
                        const publishedRounds: LetterRound[] = [];
                        let totalDone = 0;
                        let totalImages = 0;

                        roundsSnapshot.forEach(roundDoc => {
                            const r = roundDoc.data() as LetterRound;
                            if (r.status === RoundStatus.Done) {
                                totalDone++;
                                const imgCount = (r.imageUrls?.length || 0) + (r.imageUrl && !r.imageUrls?.includes(r.imageUrl) ? 1 : 0);
                                totalImages += imgCount;

                                if (r.publishReview) {
                                    publishedRounds.push(r);
                                }
                            }
                        });

                        publishedRounds.sort((a, b) => a.letter.localeCompare(b.letter));
                        const points = (totalDone * 100) + (totalImages * 25);

                        otherJourneys.push({
                            env,
                            publishedRounds,
                            totalDoneCount: totalDone,
                            points
                        });
                        processedEnvIds.add(env.id);
                    }
                }

                // Sort: Own journey always first, others by points descending
                otherJourneys.sort((a, b) => b.points - a.points);

                // Combine: Own journey first, then others sorted by points
                setPublicJourneys([...journeysData, ...otherJourneys]);

                // 3. Aggregate Stories (latest completed round for each)
                const allStories: Story[] = [];
                [...journeysData, ...otherJourneys].forEach(data => {
                    const latestRound = data.publishedRounds.reduce((prev, current) => {
                        if (!prev || !prev.date) return current;
                        if (!current.date) return prev;
                        return new Date(current.date) > new Date(prev.date) ? current : prev;
                    }, null as LetterRound | null);

                    if (latestRound && latestRound.date) {
                        const viewedKey = `viewed_story_${data.env.id}_${latestRound.letter}`;
                        const isViewed = localStorage.getItem(viewedKey) === 'true';

                        allStories.push({
                            envId: data.env.id,
                            coupleName: data.env.name || 'Unbekannt',
                            letter: latestRound.letter,
                            date: new Date(latestRound.date),
                            isViewed
                        });
                    }
                });

                // Sort: Unviewed first, then by date descending
                allStories.sort((a, b) => {
                    if (a.isViewed !== b.isViewed) return a.isViewed ? 1 : -1;
                    return b.date.getTime() - a.date.getTime();
                });

                setStories(allStories.slice(0, 20));
            } catch (err) {
                console.error("Error fetching public journeys:", err);
                setError("Fehler beim Laden der Rangliste.");
            } finally {
                setLoading(false);
            }
        };

        fetchPublicJourneys();
    }, [currentUserEnv]);

    return (
        <Box sx={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f5f7ff 0%, #ffffff 100%)',
            pb: 10
        }}>
            <Container maxWidth="sm" sx={{ pt: 4, pb: 4 }}>
                <Box sx={{ mb: 4, textAlign: 'center' }}>
                    <Typography
                        variant="h3"
                        sx={{
                            fontWeight: 900,
                            color: 'primary.main',
                            mb: 0.5,
                            letterSpacing: '-0.02em'
                        }}
                    >
                        Charts
                    </Typography>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ABC Dates Entdecker
                    </Typography>
                </Box>

                {/* Stories Header */}
                {!loading && stories.length > 0 && (
                    <Box sx={{
                        mb: 4,
                        display: 'flex',
                        overflowX: 'auto',
                        py: 2,
                        px: 1,
                        gap: 2.5,
                        '&::-webkit-scrollbar': { display: 'none' },
                        scrollbarWidth: 'none',
                        scrollBehavior: 'smooth',
                        bgcolor: 'rgba(255,255,255,0.4)',
                        borderRadius: 4,
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.6)'
                    }}>
                        {stories.map((story) => (
                            <Box
                                key={story.envId}
                                onClick={() => handleStoryClick(story.envId, story.letter)}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1,
                                    cursor: 'pointer',
                                    minWidth: 70,
                                    flexShrink: 0,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:active': { transform: 'scale(0.92)' },
                                    '&:hover': { transform: 'translateY(-2px)' }
                                }}
                            >
                                <Box sx={{
                                    width: 68,
                                    height: 68,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: story.isViewed ? '2px solid rgba(0,0,0,0.05)' : '3px solid #4caf50',
                                    p: 0.5,
                                    position: 'relative',
                                    background: 'white',
                                    boxShadow: story.isViewed ? 'none' : '0 4px 12px rgba(76, 175, 80, 0.2)'
                                }}>
                                    <Box sx={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '50%',
                                        bgcolor: story.isViewed ? 'grey.100' : 'success.light',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: story.isViewed ? 'text.disabled' : 'white',
                                        fontWeight: 900,
                                        fontSize: '1.5rem',
                                        transition: 'all 0.3s'
                                    }}>
                                        {story.letter}
                                    </Box>
                                    {!story.isViewed && (
                                        <Box sx={{
                                            position: 'absolute',
                                            top: 2,
                                            right: 2,
                                            width: 14,
                                            height: 14,
                                            bgcolor: '#2196f3',
                                            borderRadius: '50%',
                                            border: '2px solid white',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }} />
                                    )}
                                </Box>
                                <Typography variant="caption" sx={{
                                    fontWeight: 700,
                                    color: story.isViewed ? 'text.disabled' : 'text.primary',
                                    maxWidth: 70,
                                    textAlign: 'center',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontSize: '0.75rem'
                                }}>
                                    {story.coupleName}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                )}

                {/* Redesigned Intro (Speech Bubble Style) */}
                <Box sx={{
                    position: 'relative',
                    mb: 5,
                    px: 2,
                    display: 'flex',
                    justifyContent: 'center'
                }}>
                    <Box sx={{
                        bgcolor: 'background.paper',
                        p: 3,
                        borderRadius: '24px 24px 24px 4px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                        maxWidth: '90%',
                        position: 'relative',
                        border: '1px solid rgba(0,0,0,0.03)'
                    }}>
                        <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 500, lineHeight: 1.6, textAlign: 'center' }}>
                            Schau dir an, wie andere Paare ihre ABC Dates meistern. Hier findest du alle Paare, die ihre Reise veröffentlicht haben.
                        </Typography>
                    </Box>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Typography color="error" align="center">{error}</Typography>
                ) : publicJourneys.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8, opacity: 0.7 }}>
                        <Typography variant="body1">Bisher hat kein Paar seine Reise veröffentlicht.</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>Gehe in die Einstellungen, um eure Reise sichtbar zu machen!</Typography>
                    </Box>
                ) : (
                    <Box>
                        {publicJourneys.map((data) => (
                            <Accordion
                                key={data.env.id}
                                expanded={expandedEnvId === data.env.id}
                                onChange={() => setExpandedEnvId(expandedEnvId === data.env.id ? null : data.env.id)}
                                sx={{ mb: 2, borderRadius: '12px !important', overflow: 'hidden', boxShadow: '0 4px 14px 0 rgba(0,0,0,0.08)', '&:before': { display: 'none' } }}
                                ref={el => { accordionRefs.current[data.env.id] = el; }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{ py: 1, bgcolor: 'background.paper' }}
                                >
                                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Box>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.dark', lineHeight: 1.2 }}>
                                                    {data.env.name}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                                    {data.totalDoneCount} {data.totalDoneCount === 1 ? 'Date' : 'Dates'}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ bgcolor: 'secondary.light', px: 1.5, py: 0.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <StarIcon sx={{ fontSize: 14, color: 'secondary.dark' }} />
                                                <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'secondary.dark', fontSize: '0.8rem' }}>
                                                    {data.points}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        {data.isOwnJourney && (
                                            <Chip
                                                label={data.env.isPublic ? "Öffentlich" : "Privat"}
                                                size="small"
                                                color={data.env.isPublic ? "success" : "default"}
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: '0.65rem',
                                                    height: 20,
                                                    bgcolor: data.env.isPublic ? 'rgba(76, 175, 80, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                                    color: data.env.isPublic ? 'success.main' : 'text.secondary',
                                                    border: 'none'
                                                }}
                                            />
                                        )}
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ px: 0, py: 0, bgcolor: '#fbfbfb' }}>
                                    {data.publishedRounds.length === 0 ? (
                                        <Box sx={{ p: 3, textAlign: 'center' }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Dieses Paar hat noch keine Dates veröffentlicht.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Stack divider={<Divider />} spacing={0}>
                                            {data.publishedRounds.map((round) => {
                                                const images = [
                                                    ...(round.imageUrls || []),
                                                    ...(round.imageUrl && !round.imageUrls?.includes(round.imageUrl) ? [round.imageUrl] : [])
                                                ];

                                                return (
                                                    <Box key={round.letter} sx={{ p: 2, pb: 4 }}>
                                                        {/* Header: Instagram Style */}
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, px: 1 }}>
                                                            <Box sx={{
                                                                bgcolor: 'success.light',
                                                                width: 40,
                                                                height: 40,
                                                                borderRadius: '12px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'white',
                                                                fontWeight: 800,
                                                                fontSize: '1.1rem',
                                                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                                                            }}>
                                                                {round.letter}
                                                            </Box>
                                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {round.proposalText || `Date ${round.letter}`}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    {round.date && (
                                                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                                                            {new Date(round.date).toLocaleDateString('de-DE')}
                                                                        </Typography>
                                                                    )}
                                                                    {round.rating && round.rating > 0 && (
                                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                                <StarIcon
                                                                                    key={star}
                                                                                    sx={{
                                                                                        fontSize: 12,
                                                                                        color: round.rating && round.rating >= star ? '#FFD700' : '#E0E0E0'
                                                                                    }}
                                                                                />
                                                                            ))}
                                                                        </Box>
                                                                    )}
                                                                </Box>
                                                            </Box>
                                                        </Box>

                                                        <ImageCarousel images={images} letter={round.letter} />

                                                        {/* Caption/Comment style */}
                                                        {round.evaluationText && (
                                                            <Box sx={{ px: 1, mt: 1 }}>
                                                                <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                                                                    <Box component="span" sx={{ fontWeight: 800, mr: 1 }}>{data.env.name}:</Box>
                                                                    {round.evaluationText}
                                                                </Typography>
                                                            </Box>
                                                        )}

                                                        {!images.length && !round.evaluationText && (
                                                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', px: 1 }}>
                                                                Keine weiteren Details geteilt.
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                );
                                            })}
                                        </Stack>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        ))}
                    </Box>
                )}
            </Container>
        </Box>
    );
};

export default Ranking;
