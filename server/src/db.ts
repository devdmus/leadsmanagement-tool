import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'crm_management',
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;
