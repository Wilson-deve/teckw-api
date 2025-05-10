import express from "express";
import {
  initiatePayment,
  verifyPayment,
  getPayment,
  handleMoMoCallback,
} from "../controllers/payment";
import {
  validatePaymentRequest,
  validatePaymentId,
} from "../validators/payment";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.post("/", authenticate, validatePaymentRequest, initiatePayment);

router.get("/:paymentId", authenticate, validatePaymentId, getPayment);

router.get(
  "/:paymentId/verify",
  authenticate,
  validatePaymentId,
  verifyPayment
);

router.post("/webhook/momo", handleMoMoCallback);

export const paymentRoutes = router;
