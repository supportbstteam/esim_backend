import express from 'express'
import { getContacts } from '../../controllers/Contact.controllers';
import { getContent } from '../../controllers/Content.controllers';

const router = express.Router();

router.get("/contacts", getContacts);
router.get("/content/:page", getContent);
// router.post("/")

export default router;