import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AuthContext, type AuthContextType } from './AuthContext';
import type { UserProfile, Environment } from '../types';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [environment, setEnvironment] = useState<Environment | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeProfile: (() => void) | null = null;
        let unsubscribeEnv: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                // Subscribe to profile
                unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (userSnap) => {
                    if (userSnap.exists()) {
                        const userData = userSnap.data() as UserProfile;
                        setProfile(userData);

                        // If environment ID changed or not subscribed yet
                        if (!unsubscribeEnv || environment?.id !== userData.environmentId) {
                            if (unsubscribeEnv) unsubscribeEnv();
                            unsubscribeEnv = onSnapshot(doc(db, 'environments', userData.environmentId), (envSnap) => {
                                if (envSnap.exists()) {
                                    setEnvironment(envSnap.data() as Environment);
                                }
                                setLoading(false);
                            });
                        }
                    } else {
                        setLoading(false);
                    }
                }, (error) => {
                    console.error('Profile snapshot error:', error);
                    setLoading(false);
                });
                setUser(firebaseUser);
            } else {
                if (unsubscribeProfile) unsubscribeProfile();
                if (unsubscribeEnv) unsubscribeEnv();
                setUser(null);
                setProfile(null);
                setEnvironment(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
            if (unsubscribeEnv) unsubscribeEnv();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, environment, loading } as AuthContextType}>
            {children}
        </AuthContext.Provider>
    );
};
