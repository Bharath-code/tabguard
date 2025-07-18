import Root from "./label.svelte";
import type { Label as LabelPrimitive } from "bits-ui";

type Props = LabelPrimitive.Props;
type Events = LabelPrimitive.Events;

export {
	Root,
	type Props,
	type Events,
	//
	Root as Label,
	type Props as LabelProps,
	type Events as LabelEvents,
};
