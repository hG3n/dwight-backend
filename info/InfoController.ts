import express from 'express';
import * as child_process from 'child_process';
import {Request, Response} from 'express';
import {getMsg} from "../lib/Util";

const router = express.Router();

/**
 * Get current revision from git
 */
router.get('/', (req: Request, res: Response) => {
    const revision = child_process
        .execSync('git rev-parse --short HEAD')
        .toString()
        .trim();

    res.status(200).send(getMsg(true, '', {result: {version: revision}}));
});

export const InfoController = router;
