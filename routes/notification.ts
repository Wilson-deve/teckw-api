import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
} from "../controllers/notification";

const router = Router();

router.get("/notifications", authenticate, getNotifications);
router.put("/notifications/:id/read", authenticate, markAsRead);
router.put("/notifications/read-all", authenticate, markAllAsRead);

export const notificationRoutes = router;
