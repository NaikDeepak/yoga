'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';


export function VisitNoteInput({ 
  id, 
  name, 
  rows = 2,
  chips = [
    'Feeling better',
    'Pain reduced',
    'Pain increased',
    'No change',
    'Continuing same plan'
  ]
}: { 
  id: string; 
  name: string; 
  rows?: number;
  chips?: string[];
}) {
  const [val, setVal] = useState('');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {chips.map(chip => (
          <button
            key={chip}
            type="button"
            className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
            onClick={() => {
              setVal(prev => prev ? `${prev}, ${chip}` : chip);
            }}
          >
            + {chip}
          </button>
        ))}
      </div>
      <Textarea 
        id={id} 
        name={name} 
        rows={rows} 
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
    </div>
  );
}
