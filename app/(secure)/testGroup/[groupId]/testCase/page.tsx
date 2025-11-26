import TestGroupInfoTableModal from "../../../_components/testGroupInfoTableModal";
import { TestCaseListContainer } from "../_components/TestCaseListContainer";

export default function TestCaseRegistrantionPage() {
  return (
    <>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース一覧</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseListContainer />
    </>
  );
}