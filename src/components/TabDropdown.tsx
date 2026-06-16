'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function TabDropdown({
  patientId,
  activeTab,
  tabs,
}: {
  patientId: string;
  activeTab: string;
  tabs: ReadonlyArray<readonly [string, string]>;
}) {
  const router = useRouter();

  return (
    <div className="sm:hidden">
      <Select
        value={activeTab}
        onValueChange={(value) => router.push(`/patients/${patientId}?tab=${value}`)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {tabs.map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
