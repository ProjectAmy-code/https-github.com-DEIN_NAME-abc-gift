import { createContext } from 'react';
import type { User } from 'firebase/auth';

import type { UserProfile, Environment } from '../types';

export interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    environment: Environment | null;
    loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    environment: null,
    loading: true
});
