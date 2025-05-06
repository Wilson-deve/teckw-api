import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { authRoutes } from "../routes/auth";
import { userRoutes } from "../routes/users";
import { addressRoutes } from "../routes/address";
import { notificationRoutes } from "../routes/notification";
import { productRoutes } from "../routes/product";
import { orderRoutes } from "../routes/order";
import { wishlistRoutes } from "../routes/wishlist";
import { cartRoutes } from "../routes/cart";
import { reviewRoutes } from "../routes/review";
import { categoryRoutes } from "../routes/category";
import { brandRoutes } from "../routes/brand";
import { setupSwagger } from "./swagger";

dotenv.config();
const app = express();
const port = Number(process.env.PORT) || 3000;
const API = process.env.API_URL || "/api/v1";
// const hostname = "0.0.0.0";

app.use(bodyParser.json());
app.use(morgan("tiny"));
app.use(cors());
app.options("*", cors());

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/users`, addressRoutes);
app.use(`${API}/users`, notificationRoutes);
app.use(`${API}/products`, productRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/wishlist`, wishlistRoutes);
app.use(`${API}/cart`, cartRoutes);
app.use(`${API}/reviews`, reviewRoutes);
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/brands`, brandRoutes);

setupSwagger(app);

app.listen(port, () => console.log(`TecKW API up and running ${port}`));
