// Product images may be stored as URLs or bounded raster data URIs in the shared
// storefront DB. Never render HTML/SVG/script data as a product image.
export function productImageUrl(value:unknown):string|null {
  if(typeof value!=='string')return null;
  const url=value.trim();
  if(/^(https?:\/\/|\/)/.test(url))return url;
  if(url.length<=350_000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)){
    if(/^data:image\/jpeg;base64,\/9j\//.test(url)||/^data:image\/png;base64,iVBORw0KGgo/.test(url)||/^data:image\/webp;base64,UklGR/.test(url))return url;
  }
  return null;
}
