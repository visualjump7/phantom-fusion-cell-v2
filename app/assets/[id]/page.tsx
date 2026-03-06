import dynamic from "next/dynamic";

const AssetDetailClient = dynamic(
  () => import("./AssetDetailClient"),
  { ssr: false }
);

export default function AssetDetailPage() {
  return <AssetDetailClient />;
}
