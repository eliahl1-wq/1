import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    // Vänta tills AuthContext har kollat klart om vi är inloggade
    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: '50px' }}>Laddar session...</div>;
    }

    // Kontrollera om vi har en aktiv session (token)
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;