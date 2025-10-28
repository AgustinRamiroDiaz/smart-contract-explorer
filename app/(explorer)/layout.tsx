import { ReactNode } from 'react';
import ExplorerLayout from '@/app/components/ExplorerLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return <ExplorerLayout>{children}</ExplorerLayout>;
}
