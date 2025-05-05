import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  createBrand,
  deletedBrand,
  getAllBrands,
  getBrandDetails,
  getBrandsByCategory,
  getFeaturedBrands,
  updateBrand,
} from "../controllers/brand";
import { Role } from "@prisma/client";

const router = Router();

router
  .route("/")
  .get(getAllBrands)
  .post(authenticate, authorize(Role.ADMIN), createBrand);

router.route("/featured").get(getFeaturedBrands);

router.route("/categories/:categoryId").get(getBrandsByCategory);

router
  .route("/:id")
  .get(getBrandDetails)
  .put(authenticate, authorize(Role.ADMIN), updateBrand)
  .delete(authenticate, authorize(Role.ADMIN), deletedBrand);

export const brandRoutes = router;
