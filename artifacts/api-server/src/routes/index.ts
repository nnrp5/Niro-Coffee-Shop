import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountRouter from "./account";
import productsRouter from "./products";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(accountRouter);

export default router;
