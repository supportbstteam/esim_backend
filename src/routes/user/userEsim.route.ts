import express from 'express'
// import { postReserveEsim } from '../../controllers/user/userEsimControlllers';
import { getUserAllSims, getUserEsimDetails, getUserSimSummary } from '../../controllers/user/userEsimControlllers';

const router = express.Router();

router.get("/", getUserAllSims);
router.get("/:esimId", getUserEsimDetails);
router.get("/summary", getUserSimSummary);

export default router;