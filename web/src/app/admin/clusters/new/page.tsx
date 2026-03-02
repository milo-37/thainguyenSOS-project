'use client';

import dynamic from 'next/dynamic';

const ClusterForm = dynamic(() => import('../ClusterForm'), { ssr: false });

export default function NewClusterPage() {
  return <ClusterForm />;
}
