import { Router } from "express";
import {
  createReview,
  deleteReview,
  getProductReviews,
  updateReview,
} from "../controllers/review";
import { authenticate } from "../middleware/auth";

const router = Router();

router
  .route("/:productId")
  .get(getProductReviews)
  .post(authenticate, createReview);
router
  .route("/:id")
  .put(authenticate, updateReview)
  .delete(authenticate, deleteReview);

export const reviewRoutes = router;
