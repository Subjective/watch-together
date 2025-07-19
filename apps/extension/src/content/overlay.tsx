import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";

const container = document.createElement("div");
container.id = "wt-toast-container";
document.body.appendChild(container);

const root = createRoot(container);
root.render(<Toaster />);

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "SHOW_TOAST") {
    toast({
      title: message.title,
      description: message.description,
      variant: message.variant,
    });
  }
});
