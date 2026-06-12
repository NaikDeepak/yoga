'use client';

export function PrintButton() {
  return (
    <button onClick={() => window.print()}
      className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 print:hidden">
      Print / Save as PDF — प्रिंट करा
    </button>
  );
}
