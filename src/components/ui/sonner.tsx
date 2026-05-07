import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  if (typeof document === "undefined") return null;

  return createPortal(
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group !z-[1000]"
      toastOptions={{
        style: {
          borderRadius: "var(--radius)",
        },
        classNames: {
          toast:
            "group toast !rounded-[var(--radius)] group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />,
    document.body
  );
};

export { Toaster, toast };
