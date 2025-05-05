import { Router } from "express";
import {
  deleteUserAccount,
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
} from "../controllers/users";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/:id", authenticate, getUserProfile);
router.put("/:id", authenticate, updateUserProfile);
router.delete("/:id", authenticate, deleteUserAccount);
router.post("/upload-avatar", authenticate, uploadAvatar);

export const userRoutes = router;
