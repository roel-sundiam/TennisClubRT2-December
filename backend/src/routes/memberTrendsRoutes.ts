import { Router } from 'express';
import { getMemberTrends } from '../controllers/memberTrendsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.get('/', authenticateToken, getMemberTrends);
export default router;
