/**
 * The custom iOS keyboard accessory was removed in favor of the app's
 * existing tap/drag-to-dismiss behavior. Keep the exported value so existing
 * TextInput call sites can remain source-compatible without attaching an
 * accessory view.
 */
export const KEYBOARD_DONE_ACCESSORY_ID: string | undefined = undefined;
