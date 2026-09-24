import { mediaUrl } from "@/lib/auth";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#3b82f6", "#f43f5e"];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function avatarColor(name: string) {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

const SIZES = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-12 w-12 text-sm",
  lg: "h-10 w-10 text-xs",
  xl: "h-20 w-20 text-2xl",
  hero: "h-28 w-28 text-3xl"
};

export function UserAvatar({
  name,
  src,
  size = "md",
  className
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const photo = mediaUrl(src);
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full font-bold text-white",
        SIZES[size],
        className
      )}
      style={{ background: photo ? "#ede9fe" : avatarColor(name || "?") }}
    >
      {photo ? (
        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">{initials(name || "?")}</span>
      )}
    </span>
  );
}
