import React from 'react';
import Image from 'next/image';

export default function TestSummaryResultGraph() {
  return (
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">日別試験実施数</h1>
      <div className="flex justify-center items-center">
        <Image src="/images/dummyGraph.svg" alt="dummyGraph" layout="responsive" width={822} height={400} />
      </div>
    </>
  );
}