import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { init } from './wa';
import routes from './routes';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/', routes);

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const listener = () => console.log(`Server is listening on http://${host}:${port}`);

(async () => {
  await init();
  app.listen(port, host, listener);
})();
