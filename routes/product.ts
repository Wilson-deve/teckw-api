import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getShareLink,
  updateProduct,
} from "../controllers/product";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", authenticate, getProducts);
router.get("/:id", authenticate, getProductById);
router.get(":/id", authenticate, getShareLink);
router.post("/", authenticate, authorize(Role.ADMIN), createProduct);
router.put("/:id", authenticate, authorize(Role.ADMIN), updateProduct);
router.delete("/:id", authenticate, authorize(Role.ADMIN), deleteProduct);

export const productRoutes = router;
