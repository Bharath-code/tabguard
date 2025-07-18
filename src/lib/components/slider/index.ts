import Root from "./slider.svelte";
import type { Slider as SliderPrimitive } from "bits-ui";

type Props = SliderPrimitive.Props;
type Events = SliderPrimitive.Events;
type ThumbProps = SliderPrimitive.ThumbProps;
type RangeProps = SliderPrimitive.RangeProps;
type ThumbEvents = SliderPrimitive.ThumbEvents;

export {
	Root,
	type Props,
	type Events,
	type ThumbProps,
	type RangeProps,
	type ThumbEvents,
	//
	Root as Slider,
	type Props as SliderProps,
	type Events as SliderEvents,
	type ThumbProps as SliderThumbProps,
	type RangeProps as SliderRangeProps,
	type ThumbEvents as SliderThumbEvents,
};
