import { Link } from "wouter";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <p className="text-8xl font-bold text-muted-foreground/30 mb-4">404</p>
        <h1 className="text-3xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Link href="/">
            <Button>
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
