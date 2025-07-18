<script lang="ts">
	import { Label as LabelPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	type $$Props = LabelPrimitive.Props;

	let { class: className, ...rest } = $props();
</script>

<LabelPrimitive.Root
	class={cn(
		"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
		className
	)}
	{...rest}
>
	<slot />
</LabelPrimitive.Root>
