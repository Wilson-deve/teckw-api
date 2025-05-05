import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  cancelOrder,
  createOrder,
  getOrderDetails,
  getUserOrders,
} from "../controllers/order";

const router = Router();

router.post("/", authenticate, createOrder);
router.get("/", authenticate, getUserOrders);
router.get("/:id", authenticate, getOrderDetails);
router.put("/:id", authenticate, cancelOrder);

export const orderRoutes = router;
