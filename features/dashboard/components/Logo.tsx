import { cn } from "@/lib/utils";
import { ElvisLogo } from "@/features/storefront/components/ElvisLogo";
import { LogoIcon } from "./LogoIcon";

interface LogoProps {
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  variant?: "default" | "sidebar";
}

// Marca del panel: isotipo AE original sobre negro + "Elvis Automotores".
// El panel usa fondo claro, por eso el isotipo va en una placa negra (como en el original).
export const Logo = ({ className, textClassName, iconClassName, variant = "default" }: LogoProps) => {
  const isSidebar = variant === "sidebar";
  return (
    <div className={cn(className, "flex items-center text-left", isSidebar ? "gap-2" : "gap-3")}>
      <span className={cn("grid shrink-0 place-items-center rounded-md bg-black", isSidebar ? "size-8" : "size-11", iconClassName)}>
        <ElvisLogo variant="mark" title="" className={isSidebar ? "h-5 w-auto" : "h-7 w-auto"} />
      </span>
      <div className="flex flex-col justify-center">
        <span className={cn(textClassName, "font-semibold uppercase tracking-[0.12em] text-foreground", isSidebar ? "text-[13px] leading-none" : "text-lg leading-none")}>
          Elvis
        </span>
        <span className={cn("mt-1 font-medium uppercase text-muted-foreground", isSidebar ? "text-[10px] leading-none tracking-[0.28em]" : "text-[11px] tracking-[0.3em]")}>
          Automotores
        </span>
      </div>
    </div>
  );
};

export { LogoIcon };
