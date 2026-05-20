import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';

/**
 * AgarStake Core Game Component (Multiplayer Engine)
 */

export default function Game() {
    const canvasRef = useRef(null);
    const { user, token } = useAuth();
    const socketRef = useRef(null);
    
    // Använd Refs för data som ändras ofta för att slippa starta om loopen
    const playersRef = useRef([]);
    const foodRef = useRef([]);
    const myIdRef = useRef(null);
    
    const WORLD_SIZE = 5000;
    
    const [isConnected, setIsConnected] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);

    useEffect(() => {
        if (!user || !token) return;

        // Anslut till servern
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        socketRef.current = io(apiUrl, {
            auth: { token },
            transports: ['websocket'] // Tvingar WebSocket för att slippa 404-polling fel på Render
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('Connected to socket server');
            setIsConnected(true);
            // Skicka joinGame först när vi vet att pipan är öppen
            socket.emit('joinGame', { username: user?.username, token });
        });

        socket.on('init', (data) => {
            myIdRef.current = data.id;
            foodRef.current = data.food;
        });

        socket.on('tick', (data) => {
            playersRef.current = data.players;
            foodRef.current = data.food;

            // Uppdatera UI-state mer sällan för prestanda
            const me = data.players.find(p => p.id === myIdRef.current);
            if (me) setCurrentBalance(me.balance);
            
            // Enkel leaderboard-sortering
            const topPlayers = [...data.players]
                .sort((a, b) => b.mass - a.mass)
                .slice(0, 5);
            setLeaderboard(topPlayers);
        });

        socket.on('died', () => {
            alert('Game Over!');
            window.location.assign('/lobby');
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
        });

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            socket.off('tick');
            socket.off('init');
            socket.off('died');
            socket.close();
            window.removeEventListener('resize', handleResize);
        };
    }, [user, token]); // Måste lyssna på user och token så vi ansluter när de är redo

    const handleResize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    // Riktig renderingsloop som körs oberoende av Reacts state-ändringar
    useEffect(() => {
        let animationFrameId;
        const update = () => {
            render();
            animationFrameId = requestAnimationFrame(update);
        };

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            const myPlayer = playersRef.current.find(p => p.id === myIdRef.current);
            if (!myPlayer) return;

            const zoom = Math.max(0.15, Math.min(1, 1 / (1 + Math.pow(myPlayer.mass / 500, 0.5))));

            ctx.fillStyle = '#0a0a0c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-myPlayer.x, -myPlayer.y);
