import { Suspense } from "react";
import TestGroupInfoTableModal from "../../../_components/testGroupInfoTableModal";
import TestSummaryResultContainer from "./_componets/TestSummaryResultContainer";

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId: groupIdParam } = await params;
  const groupId = parseInt(groupIdParam, 10);

  return (
    <Suspense>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テスト集計結果表示</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestSummaryResultContainer groupId={groupId} />
    </Suspense>
  );
}