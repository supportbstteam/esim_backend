import express from 'express'
import { thirdPartyAuthMiddleware } from '../../middlewares/thirdPartyApi.handler';
import { getUserTopUpOrderList, getUserTopUpOrderListById, getUserTopUpPlans, postUserTopUpOrder } from '../../controllers/user/userTopUpControllers';
import { initiateCODTopUpTransaction } from '../../controllers/stripe/MobileTopUpStripe.controllers';

const router = express.Router();

router.get("/", getUserTopUpPlans)
router.post("/cod", thirdPartyAuthMiddleware, initiateCODTopUpTransaction)
router.post("/purchase", thirdPartyAuthMiddleware, postUserTopUpOrder);
router.get("/order/", getUserTopUpOrderList);

router.get("/order/:id", getUserTopUpOrderListById);

export default router;