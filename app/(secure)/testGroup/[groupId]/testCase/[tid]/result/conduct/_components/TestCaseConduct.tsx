import React from 'react';

type TestCaseConductProps = {
  values: Record<string, unknown>;
};

export function TestCaseConduct({ values }: TestCaseConductProps) {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-600">TID</p>
          <p className="text-sm">{String(values.tid || '')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">第1層</p>
          <p className="text-sm">{String(values.first_layer || '')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">第2層</p>
          <p className="text-sm">{String(values.second_layer || '')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">第3層</p>
          <p className="text-sm">{String(values.third_layer || '')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">第4層</p>
          <p className="text-sm">{String(values.fourth_layer || '')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">要求ID</p>
          <p className="text-sm">{String(values.request_id || '')}</p>
        </div>
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-gray-600">目的</p>
          <p className="text-sm">{String(values.purpose || '')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">確認観点</p>
          <p className="text-sm">{String(values.check_items || '')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">テスト手順</p>
          <p className="text-sm">{String(values.test_procedure || '')}</p>
        </div>
      </div>
    </section>
  );
}