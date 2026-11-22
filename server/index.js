import { app } from './app.js';
import { ready } from './repository.js';

const port = Number(process.env.PORT || 4000);
try {
  await ready;
  app.listen(port, '0.0.0.0', () => console.log('Lead Manager listening on port '+port));
} catch (error) {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
}
