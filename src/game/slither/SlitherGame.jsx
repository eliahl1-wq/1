import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Vi importerar klasserna men hanterar initieringen manuellt i useEffect
import './snake.js';
import './food.js';
import './game.js';

export default function SlitherGame() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const gameInstance = useRef(null);

    useEffect(() => {
        // Se till att vi har rätt bakgrund för arkad-känslan
        document.body.style.backgroundColor = '#000';
        
        // Starta spelet
        // Eftersom game.js definierar 'class game', skapar vi en instans här
        if (window.game) {
            gameInstance.current = new window.game();
        }

        return () => {
            // Cleanup: Stoppa loopen och ta bort canvas när man lämnar
            window.die = true; 
            const canvas = document.querySelector('canvas');
            if (canvas && canvas.parentNode === document.body) {
                document.body.removeChild(canvas);
            }
        };
    }, []);

    return (
        <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 100 }}>
            <button 
                onClick={() => navigate('/gamemodes')}
                style={{
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                }}
            >
                ← Leave Arena
            </button>
        </div>
    );
}