import { AvatarTile } from "./AvatarTile";

export interface FruitPickerGridProps {
  id: string;
  className?: string;
  hidden?: boolean;
  selectedId?: string | null;
  disabledIds?: string[];
  onSelect?: (fruitId: string) => void;
}

const fruitOptions = [
  { id: "banana", label: "Mr Yellow", themeClass: "theme-banana" },
  { id: "strawberry", label: "Mr Red", themeClass: "theme-strawberry" },
  { id: "kiwi", label: "Mr Green", themeClass: "theme-kiwi" },
  { id: "blueberry", label: "Mr Blue", themeClass: "theme-blueberry" }
] as const;

export function FruitPickerGrid({
  id,
  className = "fruit-picker local-fruit-grid",
  hidden = false,
  selectedId = null,
  disabledIds = [],
  onSelect
}: FruitPickerGridProps) {
  const classes = [className, hidden ? "hidden" : ""].filter(Boolean).join(" ");
  return (
    <div id={id} className={classes}>
      {fruitOptions.map((fruit) => (
        <AvatarTile
          key={fruit.id}
          fruitId={fruit.id}
          label={fruit.label}
          themeClass={fruit.themeClass}
          selected={fruit.id === selectedId}
          disabled={disabledIds.includes(fruit.id)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
