import express from 'express'
import { thirdPartyAuthMiddleware } from '../../middlewares/thirdPartyApi.handler';
import { getUserTopUpOrderList, getUserTopUpOrderListById, getUserTopUpPlans, postUserTopUpOrder } from '../../controllers/user/userTopUpControllers';

const router = express.Router();

router.get("/", getUserTopUpPlans)
router.post("/purchase", thirdPartyAuthMiddleware, postUserTopUpOrder);
router.get("/order/", getUserTopUpOrderList);

router.get("/order/:id", getUserTopUpOrderListById);

export default router;