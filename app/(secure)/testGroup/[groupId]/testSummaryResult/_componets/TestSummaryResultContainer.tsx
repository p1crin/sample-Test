'use client';
import { useState } from "react";
import TestSummaryResultGraph from "./TestSummaryResultGraph";
import { TestSummaryResultList } from "./TestSummaryResultList";
import { TestSummaryResultListRow } from "./types/test-summary-result-list-row";
import { Column } from "@/components/datagrid/DataGrid";
import { Button } from "@/components/ui/button";

type TestSummaryResultContainerProps = {
  groupId: number;
};

export default function TestSummaryResultContainer({ groupId }: TestSummaryResultContainerProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof TestSummaryResultListRow;
    direction: 'asc' | 'desc';
  } | null>(null);

  const handleSort = (key: keyof TestSummaryResultListRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleCancel = () => {
    history.back();
  };

  const columns: Column<TestSummaryResultListRow>[] = [
    { key: 'firstLayer', header: '第1層', },
    { key: 'secondLayer', header: '第2層', },
    { key: 'totalCount', header: '総項目数', },
    { key: 'targetCount', header: '対象項目数', },
    { key: 'completedCount', header: '実施済数', },
    { key: 'notStartedCount', header: '未着手数', },
    { key: 'inProgressCount', header: '実施中数', },
    { key: 'okCount', header: 'OK数', },
    { key: 'ngCount', header: 'NG数', },
    { key: 'excludedCount', header: '対象外数', },
    { key: 'okRate', header: 'OK率', },
    { key: 'progressRate', header: '進捗率', },
  ];

  return (
    <>
      <TestSummaryResultList
        groupId={groupId}
        columns={columns}
        sortConfig={sortConfig}
        onSort={handleSort}
      />
      <TestSummaryResultGraph groupId={groupId} />
      <div className="flex justify-center space-x-4 mt-4">
        <Button type="button" onClick={handleCancel} className="bg-gray-500 hover:bg-gray-400">戻る</Button>
      </div>
    </>
  );
}