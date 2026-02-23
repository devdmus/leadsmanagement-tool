import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import permissionsRoutes from './routes/permissions.js';
import rolesRoutes from './routes/roles.js';
import sitesRoutes from './routes/sites.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/sites', sitesRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`CRM Server running on http://localhost:${PORT}`);
});
