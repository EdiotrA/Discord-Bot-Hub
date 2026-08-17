import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminAuthRouter from "./adminAuth";
import adminApiRouter from "./adminApi";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminAuthRouter);
router.use(adminApiRouter);

export default router;
