// Map links that work in mainland China (Google Maps does not). They search by
// name — the app never invents an address.
export function mapLinks(nameZh: string | null, nameEn: string, city: string | null) {
  const q = nameZh || nameEn;
  const c = city ?? "";
  return [
    { label: "Amap 高德", href: `https://uri.amap.com/search?keyword=${encodeURIComponent(q)}&city=${encodeURIComponent(c)}&src=homehub&callnative=1` },
    { label: "Baidu 百度", href: `https://api.map.baidu.com/place/search?query=${encodeURIComponent(q)}&region=${encodeURIComponent(c)}&output=html&src=homehub` },
    { label: "Apple Maps", href: `https://maps.apple.com/?q=${encodeURIComponent(q + (c ? " " + c : ""))}` },
  ];
}
