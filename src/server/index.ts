import http from 'node:http';
import express from 'express';
import sourcesRouter from './routes/sources';
import queueRouter from './routes/queue';
import draftsRouter from './routes/drafts';
import articlesRouter from './routes/articles';
import sparksRouter from './routes/sparks';
import postsRouter from './routes/posts';
import scheduledRouter from './routes/scheduled';
import profileRouter from './routes/profile';
import profilesRouter from './routes/profiles';
import tagsRouter from './routes/tags';
import discoveryRouter from './routes/discovery';
import databaseRouter from './routes/database';
import overviewRouter from './routes/overview';
import reviewRouter from './routes/review';
import authLinkedinRouter from './routes/authLinkedin';
import publishLinkedinRouter from './routes/publishLinkedin';
import skillsRouter from './routes/skills';
import skillSurfaceRouter from './routes/skillSurface';
import configRouter from './routes/config';
import { attachTerminal } from './terminal';
import { attachSkillSurface } from './skill-engine';

const app = express();
app.use(express.json({ limit: '12mb' }));

app.use('/api/sources', sourcesRouter);
app.use('/api/queue', queueRouter);
app.use('/api/drafts', draftsRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/sparks', sparksRouter);
app.use('/api/posts', postsRouter);
app.use('/api/scheduled', scheduledRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/discovery', discoveryRouter);
app.use('/api/database', databaseRouter);
app.use('/api/review', reviewRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/skill-surface', skillSurfaceRouter);
app.use('/api/config', configRouter);
// profileRouter defines /pillars, /profile, /connections; overviewRouter defines
// /overview and /pillars/stats. Both mount under /api.
app.use('/api', profileRouter);
app.use('/api', overviewRouter);
// profilesRouter defines /profiles and /active-profile; both mount under /api.
app.use('/api', profilesRouter);
app.use('/api/auth', authLinkedinRouter);
app.use('/api/publish', publishLinkedinRouter);

const server = http.createServer(app);
attachTerminal(server);
attachSkillSurface(server);
server.listen(5174, () => {
  console.log('brand-console API on http://localhost:5174');
});
