import express, { NextFunction, Request, Response } from 'express';
import api from './api';

export default express()
.use('/api', api)
.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).send("Sorry can't find that!");
})
.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
