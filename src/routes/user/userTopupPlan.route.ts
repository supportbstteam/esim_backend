import express from 'express'
import { thirdPartyAuthMiddleware } from '../../middlewares/thirdPartyApi.handler';
import { getUserTopUpPlans, postUserTopUpOrder } from '../../controllers/user/userTopUpControllers';
import { initiateCODTopUpTransaction } from '../../controllers/stripe/MobileTopUpStripe.controllers';

const router = express.Router();

router.get("/", getUserTopUpPlans) // fixed
router.post("/cod", thirdPartyAuthMiddleware, initiateCODTopUpTransaction)
router.post("/purchase", thirdPartyAuthMiddleware, postUserTopUpOrder);

export default router;