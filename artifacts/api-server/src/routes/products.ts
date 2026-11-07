import { ListProductsResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { roundKwdPrice } from "../lib/pricing";
import { getSupabasePublicClient } from "../lib/supabasePublic";

const router: IRouter = Router();
type ProductCategory = "espresso" | "single" | "blend" | "drip";
type LocalizedText = { ar: string; en: string };
type ProductRecord = Record<string, unknown>;

const categoryLabels: Record<ProductCategory, LocalizedText> = {
  espresso: { ar: "إسبريسو", en: "Espresso" },
  single: { ar: "محصول واحد", en: "Single origin" },
  blend: { ar: "خلطة قهوة", en: "Coffee blend" },
  drip: { ar: "قهوة مقطرة", en: "Drip coffee" },
};
const defaultRoast: LocalizedText = { ar: "تحميص متوسط", en: "Medium roast" };

function asRecord(value: unknown): ProductRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ProductRecord;
  }
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as ProductRecord)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function localizedText(value: unknown): LocalizedText | null {
  const record = asRecord(value);
  if (record && typeof record.ar === "string" && typeof record.en === "string") {
    const ar = record.ar.trim();
    const en = record.en.trim();
    if (ar && en) return { ar: ar.slice(0, 240), en: en.slice(0, 240) };
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  const bilingual = text.match(/^(.+?)\s*\|\|\s*(.+)$/);
  if (bilingual) {
    return {
      ar: bilingual[1].trim().slice(0, 240),
      en: bilingual[2].trim().slice(0, 240),
    };
  }
  return { ar: text.slice(0, 240), en: text.slice(0, 240) };
}

function normalizeCategory(value: unknown): ProductCategory | null {
  if (typeof value !== "string") return null;
  const category = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (category.includes("espresso")) return "espresso";
  if (category.includes("single")) return "single";
  if (category.includes("blend")) return "blend";
  if (category.includes("drip")) return "drip";
  return null;
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function metadataValue(metadata: ProductRecord, key: string): unknown {
  return metadata[key];
}

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
      .select("id, name, description, price, category, image_url, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      req.log.warn({ code: error.code }, "Supabase product query failed.");
      res.status(503).json({ error: "Product catalog is unavailable." });
      return;
    }

    const products = (data ?? []).flatMap((row, index) => {
      const record = row as ProductRecord;
      const id = record.id == null ? "" : String(record.id);
      const name = localizedText(record.name);
      const category = normalizeCategory(record.category);
      const price = finiteNumber(record.price);
      if (!id || !name || !category || price == null) {
        req.log.warn(
          { productId: id || undefined, rowIndex: index },
          "Skipping a Supabase product with missing required fields.",
        );
        return [];
      }

      const metadata = asRecord(record.description) ?? {};
      const origin =
        localizedText(metadataValue(metadata, "origin")) ??
        localizedText(record.description) ??
        categoryLabels[category];
      const roast =
        localizedText(metadataValue(metadata, "roast")) ?? defaultRoast;
      const tag =
        localizedText(metadataValue(metadata, "tag")) ?? categoryLabels[category];
      const bagNameValue = metadataValue(metadata, "bagName");
      const bagName =
        typeof bagNameValue === "string" && bagNameValue.trim()
          ? bagNameValue.trim().slice(0, 40)
          : name.en.toUpperCase().slice(0, 40);
      const weightGrams = finiteNumber(metadataValue(metadata, "weightGrams"));
      const requestedSortOrder = finiteNumber(metadataValue(metadata, "sortOrder"));
      const bestSeller = metadataValue(metadata, "isBestSeller");

      return [{
        id,
        name,
        origin,
        price,
        roast,
        category,
        tag,
        bagName,
        weightGrams: weightGrams && weightGrams > 0 ? Math.round(weightGrams) : 250,
        imageUrl:
          typeof record.image_url === "string" && record.image_url.trim()
            ? record.image_url.trim()
            : "/noir-coffee-editorial.jpg",
        isBestSeller:
          typeof bestSeller === "boolean" ? bestSeller : index < 4,
        sortOrder:
          requestedSortOrder != null && requestedSortOrder >= 0
            ? Math.round(requestedSortOrder)
            : index,
      }];
    });
    const parsedProducts = ListProductsResponse.safeParse(products);

    if (!parsedProducts.success) {
      req.log.error(
        {
          issues: parsedProducts.error.issues.map(({ path, code }) => ({
            path,
            code,
          })),
        },
        "Supabase product records failed response validation.",
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
      "Supabase product catalog request failed.",
    );
    res.status(503).json({ error: "Product catalog is temporarily unavailable." });
  }
});

export default router;
