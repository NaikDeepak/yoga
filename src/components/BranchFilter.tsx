'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BRANCHES } from '@/lib/presets';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = '__all__';

export function BranchFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get('branch') ?? ALL;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) {
      params.delete('branch');
    } else {
      params.set('branch', value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="All branches / सर्व शाखा" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All branches / सर्व शाखा</SelectItem>
        {BRANCHES.map((b) => (
          <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
