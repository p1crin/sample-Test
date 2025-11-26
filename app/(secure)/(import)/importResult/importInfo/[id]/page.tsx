import { Suspense } from "react";
import { ImportInfoContainer } from "../_components/ImportInfoContainer";

type Props = {
  params: Promise<{ id: number }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense>
      <h1 className="text-2xl font-bold mt-4 pb-3">インポート内容確認</h1>
      <ImportInfoContainer id={id} />
    </Suspense>
  )
}