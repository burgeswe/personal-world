import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { to: "/", label: "Today", icon: "/icons/navigation--today.svg" },
  { to: "/chat", label: "Chat", icon: "/icons/navigation--chat.svg" },
  { to: "/world", label: "World", icon: "/icons/navigation--worlds.svg" },
  { to: "/journal", label: "Journal", icon: "/icons/navigation--journal.svg" },
  { to: "/settings", label: "Settings", icon: "/icons/navigation--settings.svg" },
];

interface SidebarNavProps {
  className?: string;
}

function SidebarNav({ className }: SidebarNavProps) {
  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "flex h-full w-48 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]",
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[var(--color-border)] px-4">
        <img
          src="/companions/personal-world.svg"
          alt=""
          className="h-7 w-7"
          aria-hidden={true}
        />
        <span
          className="ml-2 text-base font-semibold text-[var(--color-accent-primary)]"
          style={{ fontFamily: "var(--font-expressive)" }}
        >
          Personal World
        </span>
      </div>

      {/* Nav links */}
      <ul className="flex-1 space-y-0.5 p-2" role="list">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--color-elevated)] text-[var(--color-accent-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-primary)]"
                )
              }
            >
              <img src={item.icon} alt="" className="h-4 w-4" aria-hidden={true} />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Companion at bottom */}
      <div className="border-t border-[var(--color-border)] p-2.5">
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5">
          <img
            src="/companions/personal-world.svg"
            alt="Personal World companion"
            className="h-7 w-7"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">Personal World</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">System companion</p>
          </div>
        </div>
      </div>
    </nav>
  );
}

interface BottomNavProps {
  className?: string;
}

function BottomNav({ className }: BottomNavProps) {
  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--color-border)] bg-[var(--color-panel)] md:hidden",
        className
      )}
    >
      <ul className="flex w-full" role="list">
        {navItems.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-[var(--color-accent-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                )
              }
            >
              <img src={item.icon} alt="" className="h-5 w-5" aria-hidden={true} />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { SidebarNav, BottomNav, navItems };
