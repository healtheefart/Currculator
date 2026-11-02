export type NavMenu = "build" | "view";

export interface GlobalNavProps {
  active: NavMenu;
  onNavigate: (menu: NavMenu) => void;
  onBrand: () => void;
}

const MENUS: { key: NavMenu; label: string }[] = [
  { key: "build", label: "계획짜기" },
  { key: "view", label: "계획확인" },
];

export function GlobalNav({ active, onNavigate, onBrand }: GlobalNavProps) {
  return (
    <nav aria-label="주 메뉴" className="h-[var(--nav-height)] bg-[var(--surface-black)] text-[#fff]">
      <div className="mx-auto flex h-full max-w-[1024px] items-center gap-[28px] px-[22px]">
        <button
          type="button"
          onClick={onBrand}
          className="cc-type-caption-strong flex-none cursor-pointer border-0 bg-transparent p-0 text-[#fff]"
        >
          Currculator
        </button>
        {MENUS.map((menu) => {
          const current = menu.key === active;
          return (
            <button
              key={menu.key}
              type="button"
              aria-current={current ? "page" : undefined}
              onClick={() => onNavigate(menu.key)}
              className={`flex-none cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-none text-[#fff] ${
                current ? "font-semibold opacity-100" : "font-normal opacity-60"
              }`}
            >
              {menu.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
