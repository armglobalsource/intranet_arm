import type { ReactNode } from 'react';
import './statistics.css';

export default function StatisticsLayout({ children }: { children: ReactNode }) {
  return <div className="stats-module">{children}</div>;
}
