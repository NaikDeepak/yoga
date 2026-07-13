import { Loader2 } from 'lucide-react';

export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center py-12 animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Loading...
          </p>
          <p className="text-xs text-muted-foreground font-medium">
            लोड होत आहे...
          </p>
        </div>
      </div>
    </div>
  );
}
