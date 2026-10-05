import { Button } from "./button";

/** The Delete button at the foot of an edit sheet, beside Save. */
export function DeleteButton({
  onPress,
  label = "Delete",
}: {
  onPress: () => void;
  label?: string;
}) {
  return <Button label={label} icon="trash-can-outline" variant="secondary" onPress={onPress} />;
}
