import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import {
  DEFAULT_TIME_ZONE,
  localParts,
  toLocalDate,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";

/** Android date dialog; resolves to a local YYYY-MM-DD or null when dismissed. */
export function pickDate(
  initial: number = Date.now(),
  timeZone = DEFAULT_TIME_ZONE,
): Promise<string | null> {
  return new Promise((resolve) => {
    const p = localParts(initial, timeZone);
    DateTimePickerAndroid.open({
      value: new Date(p.year, p.month - 1, p.day),
      mode: "date",
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return resolve(null);
        const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        resolve(local);
      },
    });
  });
}

/** Android time dialog for a given local date; resolves to an instant or null. */
export function pickTime(
  date: string,
  initial: number = Date.now(),
  timeZone = DEFAULT_TIME_ZONE,
): Promise<number | null> {
  return new Promise((resolve) => {
    const p = localParts(initial, timeZone);
    DateTimePickerAndroid.open({
      value: new Date(2000, 0, 1, p.hour, p.minute),
      mode: "time",
      is24Hour: false,
      onChange: (event, time) => {
        if (event.type !== "set" || !time) return resolve(null);
        const [year, month, day] = date.split("-").map(Number) as [number, number, number];
        resolve(
          zonedTimeToUtc(
            { year, month, day, hour: time.getHours(), minute: time.getMinutes() },
            timeZone,
          ),
        );
      },
    });
  });
}

export { toLocalDate };
