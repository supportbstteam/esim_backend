import express from 'express'
import { getContacts } from '../../controllers/Contact.controllers';
import { getContent } from '../../controllers/Content.controllers';
import { getFaqById, getFaqs, getUserFaqs } from '../../controllers/Faq.controllers';

const router = express.Router();

router.get("/contacts", getContacts);
router.get("/content/:page", getContent);
router.get("/faq", getUserFaqs);
router.get("/faq/:id", getFaqById);
// router.post("/")

export default router;