import express from 'express'
import { deleteAdminOperator, getAdminOperatorById, getAdminOperators, postAdminAddOperator, putAdminUpdateOperator } from '../../controllers/eSim/admin/adminESimOperators.controllers';

const router = express.Router();

router.post("/create-operator", postAdminAddOperator);
router.get("/", getAdminOperators);
router.get("/:operatorId", getAdminOperatorById);
router.put("/update/:operatorId", putAdminUpdateOperator);
router.delete("/delete/:operatorId", deleteAdminOperator);

export default router;