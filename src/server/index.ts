import http from 'node:http';
import express, { type NextFunction, type Request, type Response } from 'express';
import { NoProfileError } from '../profile/loader';
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
import imagesRouter from './routes/images';
import brandRouter from './routes/brand';
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
app.use('/api/images', imagesRouter);
app.use('/api/brand', brandRouter);
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

// Zero-profile state (fresh clone): every profile-scoped route throws NoProfileError via
// getActiveProfileId(). Map it to a quiet 409 the console understands — GET /api/profiles
// returns [] and stays the one bootstrap endpoint that never needs a profile. Anything
// else falls through to Express's default handler.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof NoProfileError) {
    return res.status(409).json({ error: 'no_profile' });
  }
  next(err);
});

const server = http.createServer(app);
attachTerminal(server);
attachSkillSurface(server);
server.listen(5174, () => {
  console.log('brand-console API on http://localhost:5174');
});
