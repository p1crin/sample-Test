import DetailView from '@/components/ui/detailView';
import React from 'react';
import { TestCaseResultRow } from '../../_components/types/testCase-result-list-row';
import { TestCaseDetailRow } from './types/testCase-detail-list-row';

export type TestCaseConductState = TestCaseResultRow;
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
    controlSpec: string;
    dataFlow: string;
    testProcedure: string;
  };
};

export function TestCaseConduct({ labels, values }: TestCaseConductProps) {
  return (
    <section>
      <div className="text-left">
        <DetailView labels={labels} values={values} isFull />
      </div>
    </section>
  );
}