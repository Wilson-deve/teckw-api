import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  updateCartItem,
} from "../controllers/cart";

const router = Router();

router
  .route("/")
  .get(authenticate, getCart)
  .post(authenticate, addToCart)
  .delete(authenticate, clearCart);
router
  .route("/:itemId")
  .put(authenticate, updateCartItem)
  .delete(authenticate, removeFromCart);

export const cartRoutes = router;
