import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  addToWishlist,
  clearWishlist,
  getWishlist,
  moveToCart,
  removeFromWishlist,
  toggleWishlistItem,
} from "../controllers/wishlist";

const router = Router();

router
  .route("/")
  .get(authenticate, getWishlist)
  .post(authenticate, addToWishlist)
  .post(authenticate, toggleWishlistItem)
  .delete(authenticate, clearWishlist);
router.route("/:itemId").delete(authenticate, removeFromWishlist);
router.route("/:itemId/move-to-cart").post(authenticate, moveToCart);

export const wishlistRoutes = router;
