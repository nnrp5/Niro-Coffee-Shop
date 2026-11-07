import { ListProductsResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import type { Document } from "mongodb";
import { getMongoDatabase } from "../lib/mongo";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  if (!process.env.MONGODB_URI?.trim()) {
    req.log.warn("MONGODB_URI is not configured.");
    res.status(503).json({ error: "Product catalog is not configured." });
    return;
  }

  try {
    const database = await getMongoDatabase();
    const documents = await database
      .collection<Document>("products")
      .find(
        { isActive: { $ne: false } },
        {
          projection: {
            _id: 0,
            id: 1,
            name: 1,
            origin: 1,
            price: 1,
            roast: 1,
            category: 1,
            tag: 1,
            bagName: 1,
            weightGrams: 1,
            imageUrl: 1,
            isBestSeller: 1,
            sortOrder: 1,
          },
        },
      )
      .sort({ sortOrder: 1, id: 1 })
      .toArray();
    const parsedProducts = ListProductsResponse.safeParse(documents);

    if (!parsedProducts.success) {
      req.log.error(
        {
          issues: parsedProducts.error.issues.map(({ path, code }) => ({
            path,
            code,
          })),
        },
        "MongoDB product records failed response validation.",
      );
      res.status(500).json({ error: "Product catalog data is invalid." });
      return;
    }

    res.json(parsedProducts.data);
  } catch (error) {
    req.log.error(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "MongoDB product catalog request failed.",
    );
    res.status(503).json({ error: "Product catalog is temporarily unavailable." });
  }
});

export default router;
