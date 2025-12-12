import express from 'express'
// import { postReserveEsim } from '../../controllers/user/userEsimControlllers';
import { getUserAllSims, getUserEsimDetails, getUserSimSummary } from '../../controllers/user/userEsimControlllers';
import { thirdPartyAuthMiddleware } from '../../middlewares/thirdPartyApi.handler';

const router = express.Router();

router.get("/", getUserAllSims);
router.get("/:esimId",thirdPartyAuthMiddleware, getUserEsimDetails);
router.get("/summary",thirdPartyAuthMiddleware, getUserSimSummary);

export default router;