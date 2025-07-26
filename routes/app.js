const userRoutes = require('./routes/user');
app.use('/api', userRoutes);
const express = require('express');
const app = express();

app.use(express.json());

const authMiddleware = require('./middleware/auth');
app.use(authMiddleware);

const establishmentsRoutes = require('./routes/establishments');
app.use('/api', establishmentsRoutes);
import Assets from './pages/Assets';
// ...
<Route path="/assets" element={<Assets />} />
const express = require('express');
const app = express();

app.use(express.json());

const authMiddleware = require('./middleware/auth');
app.use(authMiddleware);

const establishmentsRoutes = require('./routes/establishments');
app.use('/api', establishmentsRoutes);
