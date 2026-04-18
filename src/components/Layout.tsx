import { Navigation } from "./Navigation";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Navigation />
      <main className="flex-1 overflow-y-auto">
        {title && (
          <div className="border-b border-border px-6 py-4">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          </div>
        )}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
