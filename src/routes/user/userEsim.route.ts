import express from 'express'
import { postReserveEsim } from '../../controllers/user/userEsimControlllers';
import { thirdPartyAuthMiddleware } from '../../middlewares/thirdPartyApi.handler';

const router = express.Router();
// router.get('')
router.post('/reserver-sim', thirdPartyAuthMiddleware, postReserveEsim);
router.post('/create-sim', thirdPartyAuthMiddleware, postReserveEsim);

export default router;