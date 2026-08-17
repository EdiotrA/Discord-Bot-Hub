import { Router, type IRouter } from "express";
import healthRouter from "./health";
import oauthRouter from "./oauth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(oauthRouter);

export default router;
