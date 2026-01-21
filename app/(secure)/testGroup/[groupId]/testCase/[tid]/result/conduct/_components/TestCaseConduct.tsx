import DetailView from '@/components/ui/detailView';
import React from 'react';
import { TestCaseDetailRow } from '../../_components/types/testCase-detail-list-row';

export type TestCaseDetailState = TestCaseDetailRow;

type TestCaseConductProps = {
  labels: {
    tid: { name: string; type: 'text' | 'img' };
    firstLayer: { name: string; type: 'text' | 'img' };
    secondLayer: { name: string; type: 'text' | 'img' };
    thirdLayer: { name: string; type: 'text' | 'img' };
    fourthLayer: { name: string; type: 'text' | 'img' };
    purpose: { name: string; type: 'text' | 'img' };
    checkItems: { name: string; type: 'text' | 'img' };
    requestId: { name: string; type: 'text' | 'img' };
    controlSpec: { name: string; type: 'text' | 'img' };
    dataFlow: { name: string; type: 'text' | 'img' };
    testProcedure: { name: string; type: 'text' | 'img' };
  };
  values: {
    tid: string;
    firstLayer: string;
    secondLayer: string;
    thirdLayer: string;
    fourthLayer: string;
    purpose: string;
    checkItems: string;
    requestId: string;
    controlSpec: { file_name: string; file_path: string }[];
    dataFlow: { file_name: string; file_path: string }[];
    testProcedure: string;
  };
};

export function TestCaseConduct({ labels, values }: TestCaseConductProps) {
  const formattedValues = {
    ...values,
    controlSpec: values.controlSpec.map(spec => spec.file_path),
    dataFlow: values.dataFlow.map(flow => flow.file_path),
  };
  return (
    <section>
      <div className="text-left">
        <DetailView labels={labels} values={formattedValues} isFull={true} />
      </div>
    </section>
  );
}