'use client';

export function DeleteButton({
  action, confirmText, label = 'Delete / काढा',
}: { action: () => Promise<unknown>; confirmText: string; label?: string }) {
  return (
    <form
      action={async () => { await action(); }}
      onSubmit={(e) => { if (!confirm(confirmText)) e.preventDefault(); }}
    >
      <button className="text-sm text-red-600 hover:underline">{label}</button>
    </form>
  );
}
