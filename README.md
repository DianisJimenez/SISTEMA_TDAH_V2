# Estructura V2 — DETEC TDAH

## Desarrollo local
En dos terminales separadas:

    cd server && npm install && npm run dev
    cd client && npm install && npm run dev

El front (Vite) corre en http://localhost:5173 y proxea /api hacia
el backend en http://localhost:3000 (ver client/vite.config.js).


