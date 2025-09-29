import { Router } from "express";
import { createUser, getUsers } from "../../controllers/user/userAuth.controllers";

const router = Router();

router.get("/", getUsers);
router.post("/", createUser);

export default router;
