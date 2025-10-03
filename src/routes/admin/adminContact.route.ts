import express from "express"
import { createContacts, deleteContact, getContacts, updateContact } from "../../controllers/Contact.controllers";

const router = express.Router();
// Contact routes
router.get("/", getContacts);
router.post("/create", createContacts);
router.put("/update/:id", updateContact);
router.delete("/delete/:id", deleteContact);

export default router;