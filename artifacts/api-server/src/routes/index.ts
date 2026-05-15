import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import vendorsRouter from "./vendors";
import servicesRouter from "./services";
import packagesRouter from "./packages";
import portfolioRouter from "./portfolio";
import storageRouter from "./storage";
import bookingsRouter from "./bookings";
import eventsRouter from "./events";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/vendors", vendorsRouter);
router.use("/services", servicesRouter);
router.use("/packages", packagesRouter);
router.use("/portfolio", portfolioRouter);
router.use(storageRouter);
router.use("/bookings", bookingsRouter);
router.use("/events", eventsRouter);

export default router;
