WITH ranked AS (
  SELECT id, image, ROW_NUMBER() OVER (PARTITION BY image ORDER BY created_at ASC, id ASC) AS rn
  FROM public.places
  WHERE image IS NOT NULL
)
UPDATE public.places SET image = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);