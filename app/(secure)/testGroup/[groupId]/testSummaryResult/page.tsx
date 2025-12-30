import { Suspense } from "react";
import TestGroupInfoTableModal from "../../../_components/testGroupInfoTableModal";
import TestSummaryResultContainer from "./_componets/TestSummaryResultContainer";


type Props = {
  params: Promise<{ groupName: string }>;
};
export default async function Page({ params }: Props) {
  const { groupName } = await params;
  const decodedGroupName = decodeURIComponent(groupName);
  return (
    <Suspense>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テスト集計結果表示</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestSummaryResultContainer groupName={decodedGroupName} />
    </Suspense>
  )
}