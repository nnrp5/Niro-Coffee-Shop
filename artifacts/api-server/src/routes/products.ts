import { ListProductsResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { roundKwdPrice } from "../lib/pricing";
import { getSupabasePublicClient } from "../lib/supabasePublic";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const supabase = getSupabasePublicClient();
  if (!supabase) {
    req.log.warn("Supabase public configuration is missing or invalid.");
    res.status(503).json({ error: "Product catalog is not configured." });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, origin, price, roast, category, tag, bag_name, weight_grams, image_url, is_best_seller, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      req.log.warn({ code: error.code }, "Supabase product query failed.");
      res.status(503).json({ error: "Product catalog is unavailable." });
      return;
    }

    const products = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      origin: row.origin,
      price: Number(row.price),
      roast: row.roast,
      category: row.category,
      tag: row.tag,
      bagName: row.bag_name,
      weightGrams: row.weight_grams,
      imageUrl: row.image_url,
      isBestSeller: row.is_best_seller,
      sortOrder: row.sort_order,
    }));
    const parsedProducts = ListProductsResponse.safeParse(products);

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

    res.json(
      parsedProducts.data.map((product) => ({
        ...product,
        price: roundKwdPrice(product.price),
      })),
    );
  } catch (error) {
    req.log.error(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "MongoDB product catalog request failed.",
    );
    res.status(503).json({ error: "Product catalog is temporarily unavailable." });
  }
});

export default router;
