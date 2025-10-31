import express from 'express'
import { adminAuthChangePassword, adminChangeNotificationMail, adminDetails, loginAdmin, registerAdmin, updateAdminProfile } from '../../controllers/admin/adminAuth.controllers';
import eSimPlanRoute from "./adminEPlan.route"
import adminCountryRoute from "./adminCountry.route"
import eSimOperatorRoute from "./adminOperator.route"
import thirdPartyRouter from "./thirdPartyUrl.route"
import eSimRoute from "./adminESim.route"
import eTopupRoute from "./adminETopup.route"
import adminUserRouter from "./adminUser.route"
import adminContactRouter from "./adminContact.route"
import adminSocialRouter from "./adminSocial.route"
import contentRouter from './adminContent.route'
import queryRoute from "./adminQuery.route"
import adminOrderRouter from "./adminOrder.route"
import adminBlogs from "./adminBlogs.route"
import adminTestimonials from "./adminTestimonial.route"
import adminFaq from "./adminFaq.route"
import { deleteTopUpOrder, getAllTopUpOrders, getTopUpOrderById, getTopUpOrdersByUser, updateTopUpOrderStatus } from '../../controllers/admin/adminTopUpOrderControllers';


const router = express.Router();

router.post("/login", loginAdmin);
router.post("/register", registerAdmin);
router.get("/details", adminDetails);
router.post("/change-password", adminAuthChangePassword);
router.post("/change-notification-mail", adminChangeNotificationMail);
router.put("/update", updateAdminProfile);

// countries
router.use("/countries", adminCountryRoute);

// operator
router.use("/operator", eSimOperatorRoute);
router.use("/third-party-api", thirdPartyRouter); // third party library api

// plans
router.use("/plans", eSimPlanRoute);

// users
router.use("/users", adminUserRouter);


router.get("/orders/top-up", getAllTopUpOrders);
router.get("/orders/top-up/:id", getTopUpOrderById);
router.get("/orders/top-up/:userId", getTopUpOrdersByUser);
router.patch("/orders/top-up/:id", updateTopUpOrderStatus);
router.delete("/orders/top-up/:id", deleteTopUpOrder);


// order
router.use("/orders", adminOrderRouter);

// --------------------------------------

router.use("/blogs", adminBlogs);
router.use("/testimonials", adminTestimonials);

// top up
router.use("/top-up", eTopupRoute);
router.use("/faq", adminFaq);

//e-sim
router.use("/e-sim", eSimRoute);

// contact
router.use("/contact", adminContactRouter);
router.use("/social-media", adminSocialRouter);
router.use("/content", contentRouter);

// query
router.use("/query", queryRoute);



export default router;