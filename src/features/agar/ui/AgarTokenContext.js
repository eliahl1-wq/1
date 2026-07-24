import { createContext, useContext } from 'react';

export const AgarTokenContext = createContext(null);

export function useAgarToken() {
    const context = useContext(AgarTokenContext);
    if (!context) {
        throw new Error('useAgarToken must be used inside AgarTokenExperience.');
    }
    return context;
}
