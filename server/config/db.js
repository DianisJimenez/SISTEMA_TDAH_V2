import mysql from 'mysql2';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'Proyecto_EEG',
    waitForConnections: true,
    connectionLimit: 10
};

export const pool = mysql.createPool(dbConfig).promise();

pool.query('SELECT 1')
    .then(() => console.log("Conexión exitosa a la base de datos Proyecto_EEG"))
    .catch(err => console.error("Error de conexión:", err.message));
