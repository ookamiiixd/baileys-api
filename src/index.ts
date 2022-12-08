import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { init } from './wa';

const app = express();
app.use(cors());
app.use(express.json());

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const listener = () => console.log(`Server is listening on http://${host}${port}`);

init();
app.listen(port, host, listener);
