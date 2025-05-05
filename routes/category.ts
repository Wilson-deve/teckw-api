import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../controllers/category";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router
  .route("/")
  .get(getCategories)
  .post(authenticate, authorize(Role.ADMIN), createCategory);
router
  .route("/:id")
  .get(getCategoryById)
  .put(authenticate, authorize(Role.ADMIN), updateCategory)
  .delete(authenticate, authorize(Role.ADMIN), deleteCategory);

export const categoryRoutes = router;
