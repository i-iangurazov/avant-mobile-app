// Same active products, categories, translations and retail prices as avantehnik.kg.
// Read-only: no stock is inferred from product visibility.
export const STOREFRONT_QUERY = `
    SELECT
      p.id AS product_id,
      p.slug AS product_slug,
      p."imageUrl" AS product_image_url,
      COALESCE(pt.description, p.description) AS product_description,
      p."sortOrder" AS product_sort_order,
      c.id AS category_id,
      c.slug AS category_slug,
      ct.name AS category_name,
      c."sortOrder" AS category_sort_order,
      s.id AS subcategory_id,
      s.slug AS subcategory_slug,
      st.name AS subcategory_name,
      s."sortOrder" AS subcategory_sort_order,
      pt.name AS product_name,
      v.id AS variant_id,
      v.price AS variant_price,
      v."priceRetail" AS variant_price_retail,
      v.sku AS variant_sku,
      vt.label AS variant_label
    FROM "Product" p
    JOIN "Category" c ON c.id = p."categoryId"
    LEFT JOIN "Subcategory" s ON s.id = p."subcategoryId" AND s."isActive" = true
    LEFT JOIN LATERAL (
      SELECT name
      FROM "CategoryTranslation"
      WHERE "categoryId" = c.id
      ORDER BY CASE locale WHEN 'ru' THEN 0 WHEN 'en' THEN 1 ELSE 2 END
      LIMIT 1
    ) ct ON true
    LEFT JOIN LATERAL (
      SELECT name
      FROM "SubcategoryTranslation"
      WHERE "subcategoryId" = s.id
      ORDER BY CASE locale WHEN 'ru' THEN 0 WHEN 'en' THEN 1 ELSE 2 END
      LIMIT 1
    ) st ON true
    LEFT JOIN LATERAL (
      SELECT name, description
      FROM "ProductTranslation"
      WHERE "productId" = p.id
      ORDER BY CASE locale WHEN 'ru' THEN 0 WHEN 'en' THEN 1 ELSE 2 END
      LIMIT 1
    ) pt ON true
    JOIN "Variant" v ON v."productId" = p.id AND v."isActive" = true
    LEFT JOIN LATERAL (
      SELECT label
      FROM "VariantTranslation"
      WHERE "variantId" = v.id
      ORDER BY CASE locale WHEN 'ru' THEN 0 WHEN 'en' THEN 1 ELSE 2 END
      LIMIT 1
    ) vt ON true
    WHERE p."isActive" = true
      AND c."isActive" = true
      AND (p."subcategoryId" IS NULL OR s.id IS NOT NULL)
    ORDER BY c."sortOrder", s."sortOrder" NULLS LAST, p."sortOrder", pt.name, v."priceRetail", v.price
  `;
