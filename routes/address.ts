import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  addAddress,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
  updateAddress,
} from "../controllers/address";

const router = Router();

router.get("/addresses", authenticate, getAddresses);
router.post("/addresses", authenticate, addAddress);
router.put("/addresses/:id", authenticate, updateAddress);
router.delete("/addresses/:id", authenticate, deleteAddress);
router.put("/addresses/:id/default", authenticate, setDefaultAddress);

export const addressRoutes = router;
